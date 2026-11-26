import fs from 'node:fs';
import path from 'node:path';
import { createBackup, pruneEmptyDirs, writeFile } from './fsx.mts';
import type { Backup } from './fsx.mts';
import { log } from './log.mts';
import { BACKUP_SUBDIR } from './paths.mts';
import { changesDisk, describeAction } from './plan.mts';
import type { FileAction } from './plan.mts';

/** Creates the backup helper of a config base. */
export const backupFor = (base: string): Backup => createBackup(path.join(base, BACKUP_SUBDIR), base);

/** Prints file actions, hiding unchanged files behind a count. */
export const printFileActions = (actions: FileAction[]): void => {
    const visible = actions.filter((action) => action.type !== 'unchanged');
    for (const action of visible) {
        const line = `${action.rel}: ${describeAction(action)}`;
        if (action.type.startsWith('skip') || action.type === 'keep-modified') log.warn(line);
        else log.info(line);
    }
    const unchanged = actions.length - visible.length;
    if (unchanged) log.info(`${unchanged} file(s) already up to date`);
};

/** Applies file actions. Existing files are copied to the backup before being overwritten or removed. */
export const applyFileActions = (base: string, actions: FileAction[], backup: Backup): void => {
    for (const action of actions.filter(changesDisk)) {
        const dest = path.join(base, action.rel);
        backup.save(dest);
        if (action.type === 'remove') {
            fs.rmSync(dest, { force: true });
            pruneEmptyDirs(base, dest);
        } else {
            writeFile(dest, fs.readFileSync(action.src));
            if (dest.endsWith('.mjs') || dest.endsWith('.sh')) fs.chmodSync(dest, 0o755);
        }
    }
};

/** Writes a file after backing up its previous version, or deletes it when content is null. */
export const replaceFile = (file: string, content: string | null, backup: Backup): void => {
    backup.save(file);
    if (content === null) fs.rmSync(file, { force: true });
    else writeFile(file, content);
};
