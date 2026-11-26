import { PLUGINS, pluginId } from './catalog.mjs';
import { run } from './exec.mjs';
import { isPlainObject } from './settings.mjs';
const parseJson = (raw) => {
    try {
        return JSON.parse(raw);
    }
    catch {
        return undefined;
    }
};
/**
 * Reads installed plugins for a scope from `claude plugin list --json`, keyed by plugin name.
 * Returns null when the Claude CLI is unavailable or the output is unreadable.
 */
export const detectPlugins = (cwd, scope) => {
    const result = run('claude', ['plugin', 'list', '--json'], { cwd });
    if (result.missing || !result.ok)
        return null;
    const entries = parseJson(result.stdout);
    if (!Array.isArray(entries))
        return null;
    const known = new Map(PLUGINS.map((plugin) => [pluginId(plugin), plugin.name]));
    const state = { enabled: new Set(), disabled: new Set() };
    for (const entry of entries) {
        if (!isPlainObject(entry) || typeof entry.id !== 'string')
            continue;
        const name = known.get(entry.id);
        if (!name || entry.scope !== scope)
            continue;
        (entry.enabled ? state.enabled : state.disabled).add(name);
    }
    return state;
};
/** Builds the CLI arguments that make a plugin installed and enabled. */
export const enableArgs = (plugin, scope, installedButDisabled) => installedButDisabled
    ? ['plugin', 'enable', pluginId(plugin), '--scope', scope]
    : ['plugin', 'install', plugin.name, '--marketplace', plugin.source, '--scope', scope, '--yes'];
const findPlugin = (name) => PLUGINS.find((candidate) => candidate.name === name);
/** Installs a stack plugin, or enables it when it is installed but disabled. */
export const enablePlugin = (name, scope, cwd, installedButDisabled) => {
    const plugin = findPlugin(name);
    return plugin !== undefined && run('claude', enableArgs(plugin, scope, installedButDisabled), { cwd }).ok;
};
/** Uninstalls a stack plugin. */
export const uninstallPlugin = (name, scope, cwd) => {
    const plugin = findPlugin(name);
    return plugin !== undefined && run('claude', ['plugin', 'uninstall', pluginId(plugin), '--scope', scope], { cwd }).ok;
};
