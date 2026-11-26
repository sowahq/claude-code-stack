import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { listFiles } from './fsx.mts';
import { HOOKS_SUBDIR, STACK_DIR, STACK_MD } from './paths.mts';
import type { Scope } from './paths.mts';

export const HOOKS_DIST_DIR = fileURLToPath(new URL('../dist/hooks/', import.meta.url));

export interface Selection {
    rules: string[];
    agents: string[];
    skills: string[];
    checks: string[];
    mcp: string[];
    plugins?: string[];
}

export interface Catalog {
    rules: string[];
    agents: string[];
    skills: string[];
    checks: string[];
    mcp: string[];
    plugins: string[];
}

export interface PluginFlag {
    rel: string;
    src: string;
}

export interface Plugin {
    name: string;
    /** Marketplace name, as in `name@marketplace`. */
    marketplace: string;
    /** GitHub `owner/repo` of the marketplace. */
    source: string;
    label: string;
    /** Executable the plugin needs on PATH. */
    binary?: string;
    /** File the plugin reads from the user config dir to enable itself. */
    globalFlag?: PluginFlag;
}

interface McpServerBase {
    name: string;
    label: string;
    /** Substring identifying the server in `claude mcp list`. */
    match: string;
}

export interface StdioMcpServer extends McpServerBase {
    transport: 'stdio';
    command: string[];
}

export interface HttpMcpServer extends McpServerBase {
    transport: 'http';
    url: string;
}

export type McpServer = StdioMcpServer | HttpMcpServer;

export interface HookCheck {
    id: string;
    label: string;
}

export const HOOK_CHECKS: HookCheck[] = [
    { id: 'commit-trailers', label: 'commit-trailers: refuse Co-Authored-By, Generated with and session links' },
    { id: 'dangerous-commands', label: 'dangerous-commands: block rm -rf on root/home, force push to main, ask on reset --hard' },
    { id: 'secret-reads', label: 'secret-reads: block cat/grep/curl on .env, keys and ~/.ssh, ~/.aws credentials' },
];

export const MCP_SERVERS: McpServer[] = [
    { name: 'svelte', label: 'Svelte: docs and autofixer', match: '@sveltejs/mcp', transport: 'stdio', command: ['npx', '-y', '@sveltejs/mcp'] },
    { name: 'ark-ui', label: 'Ark UI: component API and examples', match: '@ark-ui/mcp', transport: 'stdio', command: ['npx', '-y', '@ark-ui/mcp'] },
    { name: 'figma-mcp-go', label: 'Figma (figma-mcp-go): design data via Figma Desktop', match: 'figma-mcp-go', transport: 'stdio', command: ['npx', '-y', '@vkhanhqui/figma-mcp-go@latest'] },
    { name: 'todoist', label: 'Todoist: tasks and projects (HTTP, authenticate with /mcp)', match: 'ai.todoist.net/mcp', transport: 'http', url: 'https://ai.todoist.net/mcp' },
];

const OFFICIAL = { marketplace: 'claude-plugins-official', source: 'anthropics/claude-plugins-official' };

export const PLUGINS: Plugin[] = [
    { name: 'gopls-lsp', ...OFFICIAL, label: 'gopls-lsp: Go definitions, references and diagnostics (needs gopls)', binary: 'gopls' },
    { name: 'rust-analyzer-lsp', ...OFFICIAL, label: 'rust-analyzer-lsp: Rust code intelligence (needs rust-analyzer)', binary: 'rust-analyzer' },
    { name: 'typescript-lsp', ...OFFICIAL, label: 'typescript-lsp: TS/JS code intelligence (needs typescript-language-server)', binary: 'typescript-language-server' },
    { name: 'frontend-design', ...OFFICIAL, label: 'frontend-design: distinctive UI design guidance' },
    {
        name: 'i-have-adhd',
        marketplace: 'i-have-adhd',
        source: 'ayghri/i-have-adhd',
        label: 'i-have-adhd: action-first answers, always on',
        globalFlag: { rel: '.i-have-adhd-always', src: 'flags/i-have-adhd-always' },
    },
];

/** Returns the `name@marketplace` id Claude Code uses for a plugin. */
export const pluginId = (plugin: Plugin): string => `${plugin.name}@${plugin.marketplace}`;

const markdownNames = (dir: string): string[] =>
    fs.existsSync(dir)
        ? fs
              .readdirSync(dir)
              .filter((name) => name.endsWith('.md'))
              .map((name) => name.slice(0, -3))
              .sort()
        : [];

const directoryNames = (dir: string): string[] =>
    fs.existsSync(dir)
        ? fs
              .readdirSync(dir, { withFileTypes: true })
              .filter((entry) => entry.isDirectory())
              .map((entry) => entry.name)
              .sort()
        : [];

/** Reads what the stack ships. */
export const loadCatalog = (stackDir: string = STACK_DIR): Catalog => ({
    rules: markdownNames(path.join(stackDir, 'rules')),
    agents: markdownNames(path.join(stackDir, 'agents')),
    skills: directoryNames(path.join(stackDir, 'skills')),
    checks: HOOK_CHECKS.map((check) => check.id),
    mcp: MCP_SERVERS.map((server) => server.name),
    plugins: PLUGINS.map((plugin) => plugin.name),
});

/** Selects every shipped component except MCP servers. */
export const defaultSelection = (catalog: Catalog): Selection => ({
    rules: catalog.rules,
    agents: catalog.agents,
    skills: catalog.skills,
    checks: catalog.checks,
    mcp: [],
    plugins: catalog.plugins,
});

const V1_CATALOG: Catalog = {
    rules: ['database', 'devops', 'drizzle', 'dry', 'golang', 'javascript', 'performance', 'prisma', 'project-memory', 'rust', 'security', 'svelte', 'testing', 'todoist', 'typescript', 'writing-style'],
    agents: ['db-guardian', 'devops-docker', 'go-reviewer', 'investigator', 'rust-reviewer', 'security-auditor', 'svelte-builder'],
    skills: ['atomic-commit'],
    checks: [],
    mcp: [],
    plugins: [],
};

/**
 * Adds components shipped since the previous run to a reused selection, so updates install new rules,
 * agents, skills, checks and plugins while keeping what the user deselected out. MCP servers stay opt-in.
 * Without a record of what was offered, the v1 catalog is the baseline.
 */
export const withNewComponents = (selection: Selection, catalog: Catalog, offered: Catalog | null): Selection => {
    const baseline = offered ?? V1_CATALOG;
    const merge = (picked: string[], available: string[], seen: string[]): string[] => [
        ...new Set([...picked.filter((name) => available.includes(name)), ...available.filter((name) => !seen.includes(name))]),
    ];
    return {
        rules: merge(selection.rules, catalog.rules, baseline.rules),
        agents: merge(selection.agents, catalog.agents, baseline.agents),
        skills: merge(selection.skills, catalog.skills, baseline.skills),
        checks: merge(selection.checks, catalog.checks, baseline.checks),
        mcp: selection.mcp.filter((name) => catalog.mcp.includes(name)),
        plugins: merge(selection.plugins ?? [], catalog.plugins, baseline.plugins),
    };
};

/** Lists the compiled hook scripts to install, relative to the hooks directory. */
export const hookFiles = (hooksDir: string = HOOKS_DIST_DIR): string[] => {
    const files = listFiles(hooksDir).filter((rel) => rel.endsWith('.mjs'));
    if (!files.length) throw new Error(`No compiled hooks in ${hooksDir}: run npm run build`);
    return files;
};

/** Maps the selection to the files to install: destination (relative to the config base) to source. */
export const desiredFiles = (selection: Selection, scope: Scope, stackDir: string = STACK_DIR, hooksDir: string = HOOKS_DIST_DIR): Map<string, string> => {
    const files = new Map([[STACK_MD, path.join(stackDir, 'CLAUDE.md')]]);
    for (const rule of selection.rules) files.set(`rules/${rule}.md`, path.join(stackDir, 'rules', `${rule}.md`));
    for (const agent of selection.agents) files.set(`agents/${agent}.md`, path.join(stackDir, 'agents', `${agent}.md`));
    for (const skill of selection.skills) {
        const dir = path.join(stackDir, 'skills', skill);
        for (const rel of listFiles(dir)) files.set(`skills/${skill}/${rel}`, path.join(dir, rel));
    }
    if (selection.checks.length) {
        for (const rel of hookFiles(hooksDir)) files.set(`${HOOKS_SUBDIR}/${rel}`, path.join(hooksDir, rel));
    }
    if (scope === 'global') {
        for (const plugin of PLUGINS) {
            if (plugin.globalFlag && selection.plugins?.includes(plugin.name)) files.set(plugin.globalFlag.rel, path.join(stackDir, plugin.globalFlag.src));
        }
    }
    return files;
};
