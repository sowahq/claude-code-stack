import path from 'node:path';
import { applyFileActions, backupFor, printFileActions, replaceFile } from './apply.mts';
import type { CliOptions } from './args.mts';
import { defaultSelection, desiredFiles, HOOK_CHECKS, loadCatalog, MCP_SERVERS, PLUGINS, withNewComponents } from './catalog.mts';
import type { Catalog, Selection } from './catalog.mts';
import { withImport } from './claude-md.mts';
import { which } from './exec.mts';
import { installExtras, missingExtras } from './extras.mts';
import { readText } from './fsx.mts';
import { color, log } from './log.mts';
import { readManifest, writeManifest } from './manifest.mts';
import type { Manifest } from './manifest.mts';
import { addServer, detectConfiguredServers, removeServer } from './mcp.mts';
import type { Target } from './paths.mts';
import { changesDisk, planFiles, stripLegacyHooks } from './plan.mts';
import { detectPlugins, enablePlugin, uninstallPlugin } from './plugins.mts';
import { detectPackageManager, globalInstallCommand, installRuntime, planRuntimes } from './toolchain.mts';
import type { RuntimeAction } from './toolchain.mts';
import { confirm, selectMany } from './prompt.mts';
import type { Choice } from './prompt.mts';
import { buildSettingsTemplate, deepEqual, mergeOwned, readSettings, removeOwned, serializeSettings } from './settings.mts';

const RENAMED_TO_SKILL: Record<string, string> = { 'rules/todoist.md': 'todoist' };

/** Rebuilds a selection from the files a v1 manifest tracked. */
const selectionFromFiles = (manifest: Manifest, catalog: Catalog): Selection => {
    const rels = Object.keys(manifest.files);
    const pick = (prefix: string, names: string[], suffix: string = ''): string[] => names.filter((name) => rels.some((rel) => rel.startsWith(`${prefix}/${name}${suffix}`)));
    const renamed = Object.entries(RENAMED_TO_SKILL)
        .filter(([rel, skill]) => rels.includes(rel) && catalog.skills.includes(skill))
        .map(([, skill]) => skill);
    return {
        rules: pick('rules', catalog.rules, '.md'),
        agents: pick('agents', catalog.agents, '.md'),
        skills: [...new Set([...pick('skills', catalog.skills, '/'), ...renamed])],
        checks: catalog.checks,
        mcp: manifest.mcp.filter((name) => catalog.mcp.includes(name)),
        plugins: catalog.plugins,
    };
};

const choices = (names: string[], picked: string[], label: (name: string) => string = (name) => name): Choice<string>[] =>
    names.map((name) => ({ label: label(name), value: name, checked: picked.includes(name) }));

/** Asks which components to install, pre-checking the previous selection. */
const promptSelection = async (catalog: Catalog, initial: Selection, foreignServers: Set<string>, presentPlugins: Set<string>): Promise<Selection> => ({
    rules: await selectMany('Rules', choices(catalog.rules, initial.rules)),
    agents: await selectMany('Agents', choices(catalog.agents, initial.agents)),
    skills: await selectMany('Skills', choices(catalog.skills, initial.skills)),
    checks: await selectMany('Bash guard checks', choices(catalog.checks, initial.checks, (id) => HOOK_CHECKS.find((check) => check.id === id)?.label ?? id)),
    mcp: await selectMany(
        'MCP servers',
        choices(
            catalog.mcp.filter((name) => !foreignServers.has(name)),
            initial.mcp,
            (name) => MCP_SERVERS.find((server) => server.name === name)?.label ?? name,
        ),
    ),
    plugins: await selectMany(
        'Plugins',
        choices(catalog.plugins, initial.plugins ?? [], (name) => `${PLUGINS.find((plugin) => plugin.name === name)?.label ?? name}${presentPlugins.has(name) ? ' (installed)' : ''}`),
    ),
});

/** Prints what will happen to a plugin's runtime binary. */
const describeRuntime = (runtime: RuntimeAction, nonInteractive: boolean): void => {
    const need = `${runtime.binary} ${runtime.minMajor}+ for ${runtime.plugin}`;
    if (runtime.manager === null) {
        log.warn(`${need}: no pnpm, bun or npm found, install ${runtime.spec} globally yourself`);
        return;
    }
    const { command, args } = globalInstallCommand(runtime.manager, runtime.spec);
    const commandLine = [command, ...args].join(' ');
    if (runtime.foundMajor === null) log.info(`${need}: install with ${commandLine}`);
    else if (nonInteractive) log.warn(`${need}: found ${runtime.binary} ${runtime.foundMajor}, left untouched in --yes mode; run ${commandLine} to replace it`);
    else log.info(`${need}: replace ${runtime.binary} ${runtime.foundMajor} with ${commandLine}`);
};

/** Installs or updates the stack. */
export const install = async (target: Target, options: CliOptions): Promise<void> => {
    const catalog = loadCatalog();
    const previous = readManifest(target.base);
    if (previous && previous.scope !== target.scope) throw new Error(`Manifest in ${target.base} belongs to a ${previous.scope} install`);

    const configured = detectConfiguredServers(target.root);
    if (configured === null) log.warn('Claude Code CLI not found: MCP servers will be skipped. Install it from https://code.claude.com/docs/en/setup');
    const stackServers = new Set(previous?.mcp ?? []);
    const foreignServers = new Set([...(configured ?? [])].filter((name) => !stackServers.has(name)));

    const plugins = configured === null ? null : detectPlugins(target.root, target.mcpScope);
    if (configured !== null && plugins === null) log.warn('Could not read installed plugins: plugins will be skipped.');
    const stackPlugins = new Set(previous?.plugins ?? []);
    const presentPlugins = plugins?.enabled ?? new Set<string>();

    const reused = previous?.selection ?? (previous ? selectionFromFiles(previous, catalog) : null);
    const previousSelection = reused ? withNewComponents(reused, catalog, previous?.offered ?? null) : defaultSelection(catalog);
    const initial: Selection = previousSelection;
    const selection = options.yes ? initial : await promptSelection(catalog, initial, foreignServers, presentPlugins);
    if (configured === null) selection.mcp = previousSelection.mcp;
    if (plugins === null) selection.plugins = previousSelection.plugins ?? [];
    selection.mcp = selection.mcp.filter((name) => !foreignServers.has(name));
    const selectedPlugins = (): string[] => selection.plugins ?? [];

    const desired = desiredFiles(selection, target.scope);
    const { actions, files } = planFiles({ base: target.base, desired, owned: previous?.files ?? {}, force: options.force });

    const settingsFile = path.join(target.base, 'settings.json');
    const currentSettings = readSettings(settingsFile).data;
    const cleaned = removeOwned(stripLegacyHooks(currentSettings), previous?.settings ?? []).result;
    const merged = mergeOwned(cleaned, buildSettingsTemplate(target, selection));
    const settingsChanged = !deepEqual(currentSettings, merged.result);

    const claudeMdFile = path.join(target.root, 'CLAUDE.md');
    const claudeMdCurrent = readText(claudeMdFile);
    const claudeMdNext = withImport(claudeMdCurrent, target.importPath);

    const mcpToAdd = configured === null ? [] : selection.mcp.filter((name) => !configured.has(name));
    const mcpToRemove = [...stackServers].filter((name) => !selection.mcp.includes(name) && configured?.has(name));
    const pluginsToEnable = plugins === null ? [] : selectedPlugins().filter((name) => !presentPlugins.has(name));
    const pluginsToRemove = [...stackPlugins].filter((name) => !selectedPlugins().includes(name) && (plugins?.enabled.has(name) || plugins?.disabled.has(name)));
    const manager = detectPackageManager(process.env.npm_config_user_agent, (candidate) => which(candidate) !== null);
    const runtimes = planRuntimes(PLUGINS, selectedPlugins(), manager);
    const runtimesToInstall = runtimes.filter((runtime) => runtime.manager !== null && (runtime.foundMajor === null || !options.yes));

    log.step(`Plan (${target.scope}: ${target.base})`);
    printFileActions(actions);
    log.info(`settings.json: ${settingsChanged ? `merge ${merged.owned.length} stack entr${merged.owned.length === 1 ? 'y' : 'ies'}` : 'up to date'}`);
    log.info(`CLAUDE.md: ${claudeMdNext === claudeMdCurrent ? 'import already present' : `add @${target.importPath} import`}`);
    for (const name of mcpToAdd) log.info(`MCP ${name}: add (${target.mcpScope} scope)`);
    for (const name of mcpToRemove) log.info(`MCP ${name}: remove`);
    for (const name of pluginsToEnable) log.info(`Plugin ${name}: ${plugins?.disabled.has(name) ? 'enable' : 'install'} (${target.mcpScope} scope)`);
    for (const name of pluginsToRemove) log.info(`Plugin ${name}: uninstall`);
    for (const runtime of runtimes) describeRuntime(runtime, options.yes);

    const pending =
        actions.some(changesDisk) ||
        settingsChanged ||
        claudeMdNext !== claudeMdCurrent ||
        mcpToAdd.length > 0 ||
        mcpToRemove.length > 0 ||
        pluginsToEnable.length > 0 ||
        pluginsToRemove.length > 0 ||
        runtimesToInstall.length > 0;
    if (options.dryRun) {
        log.plain(color.dim('\nDry run: nothing was changed.'));
        return;
    }
    if (!pending && previous && !previous.migratedFrom) {
        log.success('Already up to date.');
    } else {
        if (!options.yes && !(await confirm('Apply this plan?'))) return;
        const backup = backupFor(target.base);
        applyFileActions(target.base, actions, backup);
        if (settingsChanged) replaceFile(settingsFile, serializeSettings(merged.result), backup);
        if (claudeMdNext !== claudeMdCurrent) replaceFile(claudeMdFile, claudeMdNext, backup);

        const added = mcpToAdd.filter((name) => {
            const ok = addServer(name, target.mcpScope, target.root);
            if (ok) log.success(`MCP ${name} added${name === 'todoist' ? ' (authenticate with /mcp)' : ''}`);
            else log.error(`MCP ${name} could not be added`);
            return ok;
        });
        for (const name of mcpToRemove) {
            if (removeServer(name, target.mcpScope, target.root)) log.success(`MCP ${name} removed`);
        }
        const installedPlugins = pluginsToEnable.filter((name) => {
            const wasDisabled = Boolean(plugins?.disabled.has(name));
            const ok = enablePlugin(name, target.mcpScope, target.root, wasDisabled);
            if (ok) log.success(`Plugin ${name} ${wasDisabled ? 'enabled' : 'installed'}`);
            else log.error(`Plugin ${name} could not be installed`);
            return ok && !wasDisabled;
        });
        for (const name of pluginsToRemove) {
            if (uninstallPlugin(name, target.mcpScope, target.root)) log.success(`Plugin ${name} uninstalled`);
        }
        for (const runtime of runtimesToInstall) {
            if (installRuntime(runtime)) log.success(`${runtime.binary} ${runtime.minMajor} installed for ${runtime.plugin}`);
            else log.error(`${runtime.binary} ${runtime.minMajor}+ is still not on PATH for ${runtime.plugin}: open a new shell, or check the ${runtime.manager ?? ''} global bin directory`);
        }

        writeManifest(target.base, {
            version: 2,
            scope: target.scope,
            files,
            settings: merged.owned,
            mcp: configured === null ? [...stackServers] : [...new Set([...selection.mcp.filter((name) => stackServers.has(name) && configured.has(name)), ...added])],
            mcpScope: target.mcpScope,
            plugins: plugins === null ? [...stackPlugins] : [...new Set([...[...stackPlugins].filter((name) => selectedPlugins().includes(name)), ...installedPlugins])],
            claudeImport: true,
            createdClaudeMd: previous?.createdClaudeMd ?? claudeMdCurrent === null,
            selection,
            offered: catalog,
        });
        if (backup.used()) log.info(`Backup: ${backup.dir}`);
        log.success('Stack installed.');
    }

    const extras = target.scope === 'global' && !options.yes ? missingExtras() : [];
    if (extras.length) {
        const picked = await selectMany(
            'Optional tools',
            extras.map((extra) => ({ label: extra.label, value: extra })),
        );
        installExtras(picked);
    }
};
