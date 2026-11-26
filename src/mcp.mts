import { MCP_SERVERS } from './catalog.mts';
import type { McpServer } from './catalog.mts';
import { isWindows, run } from './exec.mts';
import type { McpScope } from './paths.mts';

/**
 * Lists the stack servers already configured, matched by package or URL whatever name they were given.
 * Returns null when the Claude CLI is unavailable.
 */
export const detectConfiguredServers = (cwd: string): Set<string> | null => {
    const result = run('claude', ['mcp', 'list'], { cwd });
    if (result.missing) return null;
    const output = `${result.stdout}\n${result.stderr}`;
    return new Set(MCP_SERVERS.filter((server) => output.includes(server.match)).map((server) => server.name));
};

/** Builds `claude mcp add` arguments. Stdio `npx` servers are wrapped in `cmd /c` on native Windows. */
export const addArgs = (server: McpServer, scope: McpScope, windows: boolean = isWindows): string[] => {
    if (server.transport === 'http') return ['mcp', 'add', '--transport', 'http', '--scope', scope, server.name, server.url];
    const launch = windows && server.command[0] === 'npx' ? ['cmd', '/c', ...server.command] : server.command;
    return ['mcp', 'add', '--scope', scope, server.name, '--', ...launch];
};

/** Adds a stack MCP server with the Claude CLI. */
export const addServer = (name: string, scope: McpScope, cwd: string): boolean => {
    const server = MCP_SERVERS.find((candidate) => candidate.name === name);
    if (!server) return false;
    return run('claude', addArgs(server, scope), { cwd }).ok;
};

/** Removes an MCP server with the Claude CLI. */
export const removeServer = (name: string, scope: McpScope, cwd: string): boolean => run('claude', ['mcp', 'remove', '--scope', scope, name], { cwd }).ok;
