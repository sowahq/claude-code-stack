import path from 'node:path';
import { readText } from './fsx.mjs';
import { STACK_DIR } from './paths.mjs';
/** Tells whether a value is a non-null, non-array object. */
export const isPlainObject = (value) => typeof value === 'object' && value !== null && !Array.isArray(value);
/** Tells whether a value is an array of strings. */
export const isStringArray = (value) => Array.isArray(value) && value.every((item) => typeof item === 'string');
/** Tells whether a value is a well-formed owned settings entry. */
export const isOwnedEntry = (value) => isPlainObject(value) && (value.kind === 'value' || value.kind === 'item') && isStringArray(value.path);
const canonical = (value) => {
    if (Array.isArray(value))
        return `[${value.map(canonical).join(',')}]`;
    if (isPlainObject(value)) {
        return `{${Object.keys(value)
            .sort()
            .map((key) => `${JSON.stringify(key)}:${canonical(value[key])}`)
            .join(',')}}`;
    }
    return JSON.stringify(value);
};
/** Structural equality, insensitive to object key order. */
export const deepEqual = (a, b) => canonical(a) === canonical(b);
const clone = (value) => structuredClone(value);
const resolvePath = (root, trail) => trail.reduce((node, key) => (isPlainObject(node) ? node[key] : undefined), root);
/**
 * Merges `template` into `base` without overriding anything the user set.
 * Missing keys are added, array items are appended when absent. Returns what the stack now owns.
 */
export const mergeOwned = (base, template) => {
    const owned = [];
    const walk = (target, source, trail) => {
        for (const [key, value] of Object.entries(source)) {
            const here = [...trail, key];
            const current = target[key];
            if (Array.isArray(value)) {
                if (current !== undefined && !Array.isArray(current))
                    continue;
                const list = Array.isArray(current) ? current : [];
                for (const item of value) {
                    if (list.some((existing) => deepEqual(existing, item)))
                        continue;
                    list.push(clone(item));
                    owned.push({ kind: 'item', path: here, value: clone(item) });
                }
                if (current === undefined && list.length)
                    target[key] = list;
            }
            else if (isPlainObject(value)) {
                if (current !== undefined && !isPlainObject(current))
                    continue;
                const child = isPlainObject(current) ? current : {};
                walk(child, value, here);
                if (current === undefined && Object.keys(child).length)
                    target[key] = child;
            }
            else if (current === undefined) {
                target[key] = clone(value);
                owned.push({ kind: 'value', path: here, value: clone(value) });
            }
        }
    };
    const result = clone(base);
    walk(result, template, []);
    return { result, owned };
};
/**
 * Removes owned entries that still hold the value the stack wrote. Entries the user changed are kept.
 * Containers left empty along owned paths are pruned.
 */
export const removeOwned = (settings, owned) => {
    const result = clone(settings);
    const kept = [];
    for (const entry of owned) {
        const parent = resolvePath(result, entry.path.slice(0, -1));
        const key = entry.path.at(-1);
        if (key === undefined || !isPlainObject(parent))
            continue;
        if (entry.kind === 'value') {
            if (key in parent && deepEqual(parent[key], entry.value))
                delete parent[key];
            else if (key in parent)
                kept.push(entry);
        }
        else {
            const list = parent[key];
            if (!Array.isArray(list))
                continue;
            const index = list.findIndex((item) => deepEqual(item, entry.value));
            if (index !== -1)
                list.splice(index, 1);
        }
    }
    const trails = [...new Map(owned.map((entry) => [JSON.stringify(entry.path), entry.path])).values()]
        .flatMap((trail) => trail.map((_, index) => trail.slice(0, index + 1)))
        .sort((a, b) => b.length - a.length);
    for (const trail of trails) {
        const parent = resolvePath(result, trail.slice(0, -1));
        const key = trail.at(-1);
        if (key === undefined || !isPlainObject(parent))
            continue;
        const value = parent[key];
        if ((Array.isArray(value) && !value.length) || (isPlainObject(value) && !Object.keys(value).length))
            delete parent[key];
    }
    return { result, kept };
};
/**
 * Reconstructs what an install added by diffing the settings before and after it.
 * Used to adopt installs made by the v1 installer.
 */
export const diffOwned = (prior, wrote) => {
    const owned = [];
    const walk = (before, after, trail) => {
        for (const [key, value] of Object.entries(after)) {
            const here = [...trail, key];
            const previous = isPlainObject(before) ? before[key] : undefined;
            if (Array.isArray(value)) {
                const list = Array.isArray(previous) ? previous : [];
                for (const item of value) {
                    if (!list.some((existing) => deepEqual(existing, item)))
                        owned.push({ kind: 'item', path: here, value: item });
                }
            }
            else if (isPlainObject(value))
                walk(isPlainObject(previous) ? previous : {}, value, here);
            else if (previous === undefined)
                owned.push({ kind: 'value', path: here, value });
        }
    };
    walk(prior, wrote, []);
    return owned;
};
/** Builds the guard hook entry registered in settings.json. */
export const guardHookEntry = (guardScript, checks) => ({
    matcher: 'Bash|PowerShell',
    hooks: [{ type: 'command', command: 'node', args: [guardScript, checks.join(',')], timeout: 10 }],
});
/** Loads the settings template and adds the hook entry for the selected checks. */
export const buildSettingsTemplate = (target, selection, stackDir = STACK_DIR) => {
    const raw = readText(path.join(stackDir, 'settings.json'));
    if (raw === null)
        throw new Error('stack/settings.json is missing');
    const template = JSON.parse(raw);
    if (!isPlainObject(template))
        throw new Error('stack/settings.json must contain a JSON object');
    if (selection.checks.length) {
        const hooks = isPlainObject(template.hooks) ? template.hooks : {};
        const preToolUse = Array.isArray(hooks.PreToolUse) ? hooks.PreToolUse : [];
        template.hooks = { ...hooks, PreToolUse: [...preToolUse, guardHookEntry(target.guardScript, selection.checks)] };
    }
    return template;
};
/** Parses a settings file. Missing file gives an empty object; invalid JSON throws. */
export const readSettings = (file) => {
    const raw = readText(file);
    if (raw === null || !raw.trim())
        return { exists: raw !== null, data: {} };
    const data = JSON.parse(raw);
    if (!isPlainObject(data))
        throw new Error(`${file} must contain a JSON object`);
    return { exists: true, data };
};
/** Serializes settings the way Claude Code writes them. */
export const serializeSettings = (data) => `${JSON.stringify(data, null, 2)}\n`;
