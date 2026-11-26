import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { listFiles } from './fsx.mjs';
import { HOOKS_SUBDIR, STACK_DIR, STACK_MD } from './paths.mjs';
export const HOOKS_DIST_DIR = fileURLToPath(new URL('../dist/hooks/', import.meta.url));
export const HOOK_CHECKS = [
    { id: 'commit-trailers', label: 'commit-trailers: refuse Co-Authored-By, Generated with and session links' },
    { id: 'dangerous-commands', label: 'dangerous-commands: block rm -rf on root/home, force push to main, ask on reset --hard' },
    { id: 'secret-reads', label: 'secret-reads: block cat/grep/curl on .env, keys and ~/.ssh, ~/.aws credentials' },
];
export const MCP_SERVERS = [
    { name: 'svelte', label: 'Svelte: docs and autofixer', match: '@sveltejs/mcp', transport: 'stdio', command: ['npx', '-y', '@sveltejs/mcp'] },
    { name: 'ark-ui', label: 'Ark UI: component API and examples', match: '@ark-ui/mcp', transport: 'stdio', command: ['npx', '-y', '@ark-ui/mcp'] },
    { name: 'figma-mcp-go', label: 'Figma (figma-mcp-go): design data via Figma Desktop', match: 'figma-mcp-go', transport: 'stdio', command: ['npx', '-y', '@vkhanhqui/figma-mcp-go@latest'] },
    { name: 'todoist', label: 'Todoist: tasks and projects (HTTP, authenticate with /mcp)', match: 'ai.todoist.net/mcp', transport: 'http', url: 'https://ai.todoist.net/mcp' },
];
const OFFICIAL = { marketplace: 'claude-plugins-official', source: 'anthropics/claude-plugins-official' };
const STACK_MARKETPLACE = { marketplace: 'code-stack', source: 'sowahq/claude-code-stack' };
export const PLUGINS = [
    { name: 'gopls-lsp', ...OFFICIAL, label: 'gopls-lsp: Go definitions, references and diagnostics (needs gopls)', binary: 'gopls' },
    { name: 'rust-analyzer-lsp', ...OFFICIAL, label: 'rust-analyzer-lsp: Rust code intelligence (needs rust-analyzer)', binary: 'rust-analyzer' },
    { name: 'tsgo-lsp', ...STACK_MARKETPLACE, label: 'tsgo-lsp: TS/JS code intelligence from the native TypeScript 7 server (needs tsc 7 on PATH)', binary: 'tsc', binaryMinMajor: 7 },
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
/** Plugins the stack used to install and now removes on update, because a listed plugin replaced them. */
export const RETIRED_PLUGINS = [
    { name: 'typescript-lsp', ...OFFICIAL, label: 'typescript-lsp (replaced by tsgo-lsp: TypeScript 7 no longer ships tsserver)' },
];
export const pluginId = (plugin) => `${plugin.name}@${plugin.marketplace}`;
const markdownNames = (dir) => fs.existsSync(dir)
    ? fs
        .readdirSync(dir)
        .filter((name) => name.endsWith('.md'))
        .map((name) => name.slice(0, -3))
        .sort()
    : [];
const directoryNames = (dir) => fs.existsSync(dir)
    ? fs
        .readdirSync(dir, { withFileTypes: true })
        .filter((entry) => entry.isDirectory())
        .map((entry) => entry.name)
        .sort()
    : [];
/** Reads what the stack ships. */
export const loadCatalog = (stackDir = STACK_DIR) => ({
    rules: markdownNames(path.join(stackDir, 'rules')),
    agents: markdownNames(path.join(stackDir, 'agents')),
    skills: directoryNames(path.join(stackDir, 'skills')),
    checks: HOOK_CHECKS.map((check) => check.id),
    mcp: MCP_SERVERS.map((server) => server.name),
    plugins: PLUGINS.map((plugin) => plugin.name),
});
/** Selects every shipped component except MCP servers. */
export const defaultSelection = (catalog) => ({
    rules: catalog.rules,
    agents: catalog.agents,
    skills: catalog.skills,
    checks: catalog.checks,
    mcp: [],
    plugins: catalog.plugins,
});
const V1_CATALOG = {
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
export const withNewComponents = (selection, catalog, offered) => {
    const baseline = offered ?? V1_CATALOG;
    const merge = (picked, available, seen) => [
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
export const hookFiles = (hooksDir = HOOKS_DIST_DIR) => {
    const files = listFiles(hooksDir).filter((rel) => rel.endsWith('.mjs'));
    if (!files.length)
        throw new Error(`No compiled hooks in ${hooksDir}: run npm run build`);
    return files;
};
/** Maps the selection to the files to install: destination (relative to the config base) to source. */
export const desiredFiles = (selection, scope, stackDir = STACK_DIR, hooksDir = HOOKS_DIST_DIR) => {
    const files = new Map([[STACK_MD, path.join(stackDir, 'CLAUDE.md')]]);
    for (const rule of selection.rules)
        files.set(`rules/${rule}.md`, path.join(stackDir, 'rules', `${rule}.md`));
    for (const agent of selection.agents)
        files.set(`agents/${agent}.md`, path.join(stackDir, 'agents', `${agent}.md`));
    for (const skill of selection.skills) {
        const dir = path.join(stackDir, 'skills', skill);
        for (const rel of listFiles(dir))
            files.set(`skills/${skill}/${rel}`, path.join(dir, rel));
    }
    if (selection.checks.length) {
        for (const rel of hookFiles(hooksDir))
            files.set(`${HOOKS_SUBDIR}/${rel}`, path.join(hooksDir, rel));
    }
    if (scope === 'global') {
        for (const plugin of PLUGINS) {
            if (plugin.globalFlag && selection.plugins?.includes(plugin.name))
                files.set(plugin.globalFlag.rel, path.join(stackDir, plugin.globalFlag.src));
        }
    }
    return files;
};
