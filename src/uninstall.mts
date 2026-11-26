import path from 'node:path';
import { applyFileActions, backupFor, printFileActions, replaceFile } from './apply.mts';
import type { CliOptions } from './args.mts';
import { hasImport, withoutImport } from './claude-md.mts';
import { readText } from './fsx.mts';
import { color, log } from './log.mts';
import { deleteManifest, readManifest } from './manifest.mts';
import { removeServer } from './mcp.mts';
import type { Target } from './paths.mts';
import { planRemoval } from './plan.mts';
import { uninstallPlugin } from './plugins.mts';
import { confirm } from './prompt.mts';
import { deepEqual, readSettings, removeOwned, serializeSettings } from './settings.mts';

/** Removes everything the manifest says the stack installed. */
export const uninstall = async (target: Target, options: CliOptions): Promise<void> => {
    const manifest = readManifest(target.base);
    if (!manifest) {
        log.warn(`No stack manifest in ${target.base}: nothing to uninstall.`);
        return;
    }

    const actions = planRemoval(target.base, manifest.files, options.force);
    const settingsFile = path.join(target.base, 'settings.json');
    const current = readSettings(settingsFile);
    const { result: settings, kept } = removeOwned(current.data, manifest.settings);
    const settingsChanged = !deepEqual(current.data, settings);
    const claudeMdFile = path.join(target.root, 'CLAUDE.md');
    const claudeMd = readText(claudeMdFile);
    const claudeMdNext = claudeMd !== null && hasImport(claudeMd) ? withoutImport(claudeMd) : claudeMd;
    const plugins = manifest.plugins ?? [];

    log.step(`Uninstall plan (${target.scope}: ${target.base})`);
    printFileActions(actions);
    log.info(`settings.json: ${settingsChanged ? 'remove stack entries' : 'nothing to remove'}`);
    for (const entry of kept) log.warn(`settings.json: keep ${entry.path.join('.')} (you changed it)`);
    if (claudeMdNext !== claudeMd) log.info(`CLAUDE.md: remove the stack import${claudeMdNext === null && manifest.createdClaudeMd ? ' and the file' : ''}`);
    for (const name of manifest.mcp) log.info(`MCP ${name}: remove`);
    for (const name of plugins) log.info(`Plugin ${name}: uninstall`);

    if (options.dryRun) {
        log.plain(color.dim('\nDry run: nothing was changed.'));
        return;
    }
    if (!options.yes && !(await confirm('Uninstall the stack?', false))) return;

    const backup = backupFor(target.base);
    applyFileActions(target.base, actions, backup);
    if (settingsChanged) replaceFile(settingsFile, serializeSettings(settings), backup);
    if (claudeMdNext !== claudeMd) replaceFile(claudeMdFile, claudeMdNext ?? (manifest.createdClaudeMd ? null : ''), backup);
    for (const name of manifest.mcp) {
        if (removeServer(name, manifest.mcpScope, target.root)) log.success(`MCP ${name} removed`);
    }
    for (const name of plugins) {
        if (uninstallPlugin(name, manifest.mcpScope, target.root)) log.success(`Plugin ${name} uninstalled`);
    }
    deleteManifest(target.base);
    if (backup.used()) log.info(`Backup: ${backup.dir}`);
    log.success('Stack uninstalled. Tools such as rtk and plugins you installed yourself are left in place.');
};
