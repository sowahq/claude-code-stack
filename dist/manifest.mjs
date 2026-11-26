import fs from 'node:fs';
import path from 'node:path';
import legacyTemplates from './legacy-v1-templates.json' with { type: 'json' };
import { readText, writeFile } from './fsx.mjs';
import { MANIFEST_FILE } from './paths.mjs';
import { deepEqual, diffOwned, isOwnedEntry, isPlainObject, isStringArray } from './settings.mjs';
const LEGACY_TEMPLATES = legacyTemplates;
const isScope = (value) => value === 'global' || value === 'project';
const isMcpScope = (value) => value === 'user' || value === 'project';
const isFileHashes = (value) => isPlainObject(value) && Object.values(value).every((hash) => hash === null || typeof hash === 'string');
const isSelection = (value) => isPlainObject(value) &&
    isStringArray(value.rules) &&
    isStringArray(value.agents) &&
    isStringArray(value.skills) &&
    isStringArray(value.checks) &&
    isStringArray(value.mcp) &&
    (value.plugins === undefined || isStringArray(value.plugins));
const isCatalog = (value) => isSelection(value) && isStringArray(value.plugins);
/** Tells whether parsed JSON is a well-formed v2 manifest. */
export const isManifest = (value) => isPlainObject(value) &&
    value.version === 2 &&
    isScope(value.scope) &&
    isFileHashes(value.files) &&
    Array.isArray(value.settings) &&
    value.settings.every(isOwnedEntry) &&
    isStringArray(value.mcp) &&
    isMcpScope(value.mcpScope) &&
    (value.plugins === undefined || isStringArray(value.plugins)) &&
    typeof value.claudeImport === 'boolean' &&
    typeof value.createdClaudeMd === 'boolean' &&
    (value.selection === null || isSelection(value.selection)) &&
    (value.offered === undefined || isCatalog(value.offered));
/**
 * Tells whether a v1 template shipped this entry. Keys the user added between v1 runs also
 * show up in the v1 diff, and must stay theirs.
 */
export const shippedByV1 = (entry, templates = LEGACY_TEMPLATES) => templates.some((template) => {
    const value = entry.path.reduce((node, key) => (isPlainObject(node) ? node[key] : undefined), template);
    return entry.kind === 'value' ? deepEqual(value, entry.value) : Array.isArray(value) && value.some((item) => deepEqual(item, entry.value));
});
/** Returns the manifest location for a config base. */
export const manifestPath = (base) => path.join(base, MANIFEST_FILE);
/** Returns a manifest that owns nothing. */
export const emptyManifest = (scope, mcpScope) => ({
    version: 2,
    scope,
    files: {},
    settings: [],
    mcp: [],
    mcpScope,
    plugins: [],
    claudeImport: false,
    createdClaudeMd: false,
    selection: null,
});
const migrateV1Settings = (legacy) => {
    if (!isPlainObject(legacy) || typeof legacy.wrote !== 'string' || !legacy.wrote)
        return [];
    try {
        const prior = typeof legacy.prior === 'string' && legacy.prior ? JSON.parse(legacy.prior) : {};
        const wrote = JSON.parse(legacy.wrote);
        if (!isPlainObject(wrote))
            return [];
        return diffOwned(isPlainObject(prior) ? prior : {}, wrote).filter((entry) => shippedByV1(entry));
    }
    catch {
        return [];
    }
};
/**
 * Converts a v1 manifest (written by the old setup.js) to v2.
 * v1 paths were relative to the install root, so project installs carried a `.claude/` prefix.
 */
export const migrateV1 = (legacy) => {
    const scope = legacy.scope === 'project' ? 'project' : 'global';
    const strip = (rel) => (scope === 'project' ? rel.replace(/^\.claude\//, '') : rel);
    const files = Array.isArray(legacy.files) ? legacy.files.filter((rel) => typeof rel === 'string') : [];
    return {
        ...emptyManifest(scope, legacy.mcpScope === 'project' ? 'project' : 'user'),
        files: Object.fromEntries(files.map((rel) => [strip(rel), null])),
        settings: migrateV1Settings(legacy.settings),
        mcp: isStringArray(legacy.mcp) ? legacy.mcp : [],
        claudeImport: Boolean(legacy.claudeImport),
        createdClaudeMd: Boolean(legacy.createdClaudeMd),
        migratedFrom: 1,
    };
};
/** Reads the manifest of a config base, migrating v1 on the fly. Returns null when there is none. */
export const readManifest = (base) => {
    const file = manifestPath(base);
    const raw = readText(file);
    if (raw === null)
        return null;
    const data = JSON.parse(raw);
    if (!isPlainObject(data))
        throw new Error(`${file} must contain a JSON object`);
    if (data.version !== 2)
        return migrateV1(data);
    if (!isManifest(data))
        throw new Error(`${file} is not a valid v2 manifest`);
    return data;
};
/** Writes the manifest of a config base. */
export const writeManifest = (base, manifest) => writeFile(manifestPath(base), `${JSON.stringify(manifest, null, 2)}\n`);
/** Deletes the manifest of a config base. */
export const deleteManifest = (base) => fs.rmSync(manifestPath(base), { force: true });
