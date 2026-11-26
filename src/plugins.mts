import { PLUGINS, RETIRED_PLUGINS, pluginId } from './catalog.mts';
import type { Plugin } from './catalog.mts';
import { run } from './exec.mts';
import type { McpScope } from './paths.mts';
import { isPlainObject } from './settings.mts';

export interface PluginState {
    enabled: Set<string>;
    disabled: Set<string>;
}

const parseJson = (raw: string): unknown => {
    try {
        return JSON.parse(raw);
    } catch {
        return undefined;
    }
};

/**
 * Reads installed plugins for a scope from `claude plugin list --json`, keyed by plugin name.
 * Returns null when the Claude CLI is unavailable or the output is unreadable.
 */
export const detectPlugins = (cwd: string, scope: McpScope): PluginState | null => {
    const result = run('claude', ['plugin', 'list', '--json'], { cwd });
    if (result.missing || !result.ok) return null;
    const entries = parseJson(result.stdout);
    if (!Array.isArray(entries)) return null;
    const known = new Map([...PLUGINS, ...RETIRED_PLUGINS].map((plugin) => [pluginId(plugin), plugin.name]));
    const state: PluginState = { enabled: new Set(), disabled: new Set() };
    for (const entry of entries) {
        if (!isPlainObject(entry) || typeof entry.id !== 'string') continue;
        const name = known.get(entry.id);
        if (!name || entry.scope !== scope) continue;
        (entry.enabled ? state.enabled : state.disabled).add(name);
    }
    return state;
};

/** Builds the CLI arguments that make a plugin installed and enabled. */
export const enableArgs = (plugin: Plugin, scope: McpScope, installedButDisabled: boolean): string[] =>
    installedButDisabled
        ? ['plugin', 'enable', pluginId(plugin), '--scope', scope]
        : ['plugin', 'install', plugin.name, '--marketplace', plugin.source, '--scope', scope, '--yes'];

const findPlugin = (name: string): Plugin | undefined => [...PLUGINS, ...RETIRED_PLUGINS].find((candidate) => candidate.name === name);

/** Installs a stack plugin, or enables it when it is installed but disabled. */
export const enablePlugin = (name: string, scope: McpScope, cwd: string, installedButDisabled: boolean): boolean => {
    const plugin = findPlugin(name);
    return plugin !== undefined && run('claude', enableArgs(plugin, scope, installedButDisabled), { cwd }).ok;
};

/** Uninstalls a stack plugin. */
export const uninstallPlugin = (name: string, scope: McpScope, cwd: string): boolean => {
    const plugin = findPlugin(name);
    return plugin !== undefined && run('claude', ['plugin', 'uninstall', pluginId(plugin), '--scope', scope], { cwd }).ok;
};
