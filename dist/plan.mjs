import fs from 'node:fs';
import path from 'node:path';
import { hashFile, readText, sha256 } from './fsx.mjs';
import { isPlainObject } from './settings.mjs';
const LEGACY_FILES = [{ rel: 'hooks/block-commit-trailers.sh', marker: 'Co-Authored-By:|Co-authored-by:|Claude-Session:' }];
const LEGACY_HOOK_MARKER = 'block-commit-trailers.sh';
/**
 * Plans file writes and removals so the config base matches the desired files.
 * Files the user edited after install, and files the stack never owned, are left alone unless `force` is set.
 */
export const planFiles = ({ base, desired, owned, force }) => {
    const actions = [];
    const files = {};
    for (const [rel, src] of desired) {
        const dest = path.join(base, rel);
        const wanted = sha256(fs.readFileSync(src));
        const current = hashFile(dest);
        const ownedHash = owned[rel];
        const isOwned = ownedHash !== undefined;
        const pristine = isOwned && (ownedHash === null || ownedHash === current);
        if (current === null)
            actions.push({ type: 'create', rel, src });
        else if (current === wanted)
            actions.push({ type: isOwned ? 'unchanged' : 'adopt', rel });
        else if (pristine || force)
            actions.push({ type: 'update', rel, src });
        else {
            actions.push({ type: isOwned ? 'skip-modified' : 'skip-foreign', rel });
            if (isOwned)
                files[rel] = ownedHash;
            continue;
        }
        files[rel] = wanted;
    }
    for (const [rel, hash] of Object.entries(owned)) {
        if (desired.has(rel))
            continue;
        const current = hashFile(path.join(base, rel));
        if (current === null)
            continue;
        if (hash === null || hash === current || force)
            actions.push({ type: 'remove', rel });
        else
            actions.push({ type: 'keep-modified', rel });
    }
    for (const { rel, marker } of LEGACY_FILES) {
        if (rel in owned || desired.has(rel))
            continue;
        const content = readText(path.join(base, rel));
        if (content !== null && content.includes(marker))
            actions.push({ type: 'remove', rel });
    }
    return { actions, files };
};
/** Plans removal of every owned file for uninstall. */
export const planRemoval = (base, owned, force) => Object.entries(owned).flatMap(([rel, hash]) => {
    const current = hashFile(path.join(base, rel));
    if (current === null)
        return [];
    if (hash === null || hash === current || force)
        return [{ type: 'remove', rel }];
    return [{ type: 'keep-modified', rel }];
});
const isLegacyHookGroup = (group) => isPlainObject(group) && Array.isArray(group.hooks) && group.hooks.some((hook) => isPlainObject(hook) && String(hook.command ?? '').includes(LEGACY_HOOK_MARKER));
/** Drops hook entries registered by the v1 installer, which pointed at the removed bash script. */
export const stripLegacyHooks = (settings) => {
    const hooks = settings.hooks;
    if (!isPlainObject(hooks) || !Array.isArray(hooks.PreToolUse))
        return settings;
    const groups = hooks.PreToolUse;
    const kept = groups.filter((group) => !isLegacyHookGroup(group));
    if (kept.length === groups.length)
        return settings;
    const nextHooks = { ...hooks, PreToolUse: kept };
    if (!kept.length)
        delete nextHooks.PreToolUse;
    const next = { ...settings, hooks: nextHooks };
    if (!Object.keys(nextHooks).length)
        delete next.hooks;
    return next;
};
const LABELS = {
    create: 'create',
    update: 'update',
    adopt: 'adopt (identical file already there)',
    unchanged: 'unchanged',
    remove: 'remove',
    'skip-modified': 'skip (you modified it, use --force)',
    'skip-foreign': 'skip (exists, not managed by the stack, use --force)',
    'keep-modified': 'keep (you modified it, no longer shipped)',
};
/** Returns the human label of a file action. */
export const describeAction = (action) => LABELS[action.type];
/** Tells whether a file action writes or deletes a file. */
export const changesDisk = (action) => action.type === 'create' || action.type === 'update' || action.type === 'remove';
