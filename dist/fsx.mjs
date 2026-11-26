import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
const isErrnoException = (error) => error instanceof Error && 'code' in error;
/** Reads a UTF-8 file, or returns null when it does not exist. */
export const readText = (file) => {
    try {
        return fs.readFileSync(file, 'utf8');
    }
    catch (error) {
        if (isErrnoException(error) && error.code === 'ENOENT')
            return null;
        throw error;
    }
};
/** Returns the hex sha256 of a string or buffer. */
export const sha256 = (content) => createHash('sha256').update(content).digest('hex');
/** Returns the sha256 of a file, or null when it does not exist. */
export const hashFile = (file) => (fs.existsSync(file) ? sha256(fs.readFileSync(file)) : null);
/** Writes a file, creating its parent directories. */
export const writeFile = (file, content) => {
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, content);
};
/** Lists files under a directory, as forward-slash paths relative to it. */
export const listFiles = (dir) => {
    if (!fs.existsSync(dir))
        return [];
    return fs
        .readdirSync(dir, { recursive: true, withFileTypes: true })
        .filter((entry) => entry.isFile() && entry.name !== '.DS_Store')
        .map((entry) => path.relative(dir, path.join(entry.parentPath, entry.name)).split(path.sep).join('/'))
        .sort();
};
/** Removes now-empty parent directories of a file, stopping at `root`. */
export const pruneEmptyDirs = (root, file) => {
    let dir = path.dirname(file);
    while (dir.startsWith(root) && dir !== root) {
        if (!fs.existsSync(dir) || fs.readdirSync(dir).length)
            return;
        fs.rmdirSync(dir);
        dir = path.dirname(dir);
    }
};
/** Creates a backup helper that copies files into a timestamped folder before they change. */
export const createBackup = (backupRoot, base) => {
    const stamp = new Date().toISOString().replace(/[:.]/g, '-');
    const dir = path.join(backupRoot, stamp);
    let count = 0;
    return {
        dir,
        used: () => count > 0,
        save: (file) => {
            if (!fs.existsSync(file))
                return null;
            const rel = path.relative(base, file);
            const dest = path.join(dir, rel.startsWith('..') ? path.basename(file) : rel);
            fs.mkdirSync(path.dirname(dest), { recursive: true });
            fs.copyFileSync(file, dest);
            count++;
            return dest;
        },
    };
};
