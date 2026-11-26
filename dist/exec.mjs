import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import path from 'node:path';
const isWindows = process.platform === 'win32';
/** Resolves an executable on PATH, honouring PATHEXT on Windows. */
export const which = (name) => {
    const dirs = (process.env.PATH ?? '').split(path.delimiter).filter(Boolean);
    const extensions = isWindows ? (process.env.PATHEXT ?? '.EXE;.CMD;.BAT;.COM').split(';') : [''];
    for (const dir of dirs) {
        for (const ext of extensions) {
            const candidate = path.join(dir, `${name}${ext.toLowerCase()}`);
            if (existsSync(candidate))
                return candidate;
            const upper = path.join(dir, `${name}${ext}`);
            if (existsSync(upper))
                return upper;
        }
    }
    return null;
};
const quoteForCmd = (arg) => (/^[\w@./:=+-]+$/.test(arg) ? arg : `"${arg.replace(/"/g, '""')}"`);
/** Runs a program without a shell. `.cmd`/`.bat` shims on Windows go through cmd.exe. */
export const run = (name, args, { cwd, inherit = false } = {}) => {
    const resolved = which(name);
    if (!resolved)
        return { ok: false, stdout: '', stderr: `${name} not found on PATH`, missing: true };
    const viaCmd = isWindows && /\.(cmd|bat)$/i.test(resolved);
    const file = viaCmd ? (process.env.ComSpec ?? 'cmd.exe') : resolved;
    const argv = viaCmd ? ['/d', '/s', '/c', `"${[quoteForCmd(resolved), ...args.map(quoteForCmd)].join(' ')}"`] : args;
    const result = spawnSync(file, argv, {
        cwd,
        encoding: 'utf8',
        stdio: inherit ? 'inherit' : ['ignore', 'pipe', 'pipe'],
        windowsVerbatimArguments: viaCmd,
    });
    return {
        ok: result.status === 0,
        stdout: result.stdout ?? '',
        stderr: result.stderr ?? result.error?.message ?? '',
        missing: false,
    };
};
export { isWindows };
