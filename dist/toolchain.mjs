import { run, which } from './exec.mjs';
const FALLBACK_ORDER = ['pnpm', 'bun', 'npm'];
/** Reads the first `major.minor` version printed by a tool and returns the major number. */
export const parseMajorVersion = (output) => {
    const match = /(\d+)\.\d+/.exec(output);
    return match?.[1] === undefined ? null : Number(match[1]);
};
/** Returns the major version of an executable on PATH, or null when it is missing or unreadable. */
export const binaryMajor = (binary) => {
    if (!which(binary))
        return null;
    return parseMajorVersion(run(binary, ['--version']).stdout);
};
/**
 * Picks the package manager to install global tools with. The one that launched the installer wins
 * (`npx`, `pnpm dlx` and `bunx` set `npm_config_user_agent`); otherwise the first available of pnpm, bun, npm.
 */
export const detectPackageManager = (userAgent, isAvailable) => {
    const launcher = FALLBACK_ORDER.find((manager) => userAgent?.startsWith(`${manager}/`));
    if (launcher && isAvailable(launcher))
        return launcher;
    return FALLBACK_ORDER.find(isAvailable) ?? null;
};
/** Builds the command that installs a package globally with a given package manager. */
export const globalInstallCommand = (manager, spec) => ({
    command: manager,
    args: manager === 'npm' ? ['install', '--global', spec] : ['add', '--global', spec],
});
/** Lists the selected plugins whose runtime binary is missing or older than they need. */
export const planRuntimes = (plugins, selected, manager) => plugins.flatMap((plugin) => {
    const { binary, binaryMinMajor, binaryPackage } = plugin;
    if (!selected.includes(plugin.name) || binary === undefined || binaryMinMajor === undefined || binaryPackage === undefined)
        return [];
    const foundMajor = binaryMajor(binary);
    if (foundMajor !== null && foundMajor >= binaryMinMajor)
        return [];
    return [{ plugin: plugin.name, binary, spec: binaryPackage, minMajor: binaryMinMajor, foundMajor, manager }];
});
/** Installs a runtime with its package manager and reports whether the binary now meets the minimum version. */
export const installRuntime = (action) => {
    if (action.manager === null)
        return false;
    const { command, args } = globalInstallCommand(action.manager, action.spec);
    if (!run(command, args, { inherit: true }).ok)
        return false;
    const major = binaryMajor(action.binary);
    return major !== null && major >= action.minMajor;
};
