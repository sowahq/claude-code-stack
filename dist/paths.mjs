import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
export const STACK_DIR = fileURLToPath(new URL('../stack/', import.meta.url));
export const STACK_MD = 'claude-code-stack.md';
export const HOOKS_SUBDIR = 'hooks/claude-code-stack';
export const MANIFEST_FILE = '.claude-code-stack-manifest.json';
export const BACKUP_SUBDIR = '.claude-code-stack/backups';
/** Converts a path to forward slashes so it works in settings.json on every platform. */
export const toPosix = (value) => value.split(path.sep).join('/');
/** Returns the user config directory: CLAUDE_CONFIG_DIR, or ~/.claude. */
export const userConfigDir = (env = process.env) => env.CLAUDE_CONFIG_DIR ? path.resolve(env.CLAUDE_CONFIG_DIR) : path.join(os.homedir(), '.claude');
/** Resolves where the stack is installed for a scope. */
export const resolveTarget = (scope, projectDir, env = process.env) => {
    if (scope === 'global') {
        const base = userConfigDir(env);
        return {
            scope,
            root: base,
            base,
            importPath: STACK_MD,
            guardScript: `${toPosix(base)}/${HOOKS_SUBDIR}/guard-bash.mjs`,
            mcpScope: 'user',
        };
    }
    const root = path.resolve(projectDir);
    return {
        scope,
        root,
        base: path.join(root, '.claude'),
        importPath: `.claude/${STACK_MD}`,
        guardScript: `\${CLAUDE_PROJECT_DIR}/.claude/${HOOKS_SUBDIR}/guard-bash.mjs`,
        mcpScope: 'project',
    };
};
