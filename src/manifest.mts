import fs from 'node:fs';
import path from 'node:path';
import legacyTemplates from './legacy-v1-templates.json' with { type: 'json' };
import type { Catalog, Selection } from './catalog.mts';
import { readText, writeFile } from './fsx.mts';
import { MANIFEST_FILE } from './paths.mts';
import type { McpScope, Scope } from './paths.mts';
import { deepEqual, diffOwned, isOwnedEntry, isPlainObject, isStringArray } from './settings.mts';
import type { OwnedEntry } from './settings.mts';

const LEGACY_TEMPLATES: readonly unknown[] = legacyTemplates;

export interface Manifest {
    version: 2;
    scope: Scope;
    /** Installed files relative to the config base, with their sha256 (null when unknown). */
    files: Record<string, string | null>;
    settings: OwnedEntry[];
    mcp: string[];
    mcpScope: McpScope;
    /** Plugins the stack installed (not the ones that were already there). */
    plugins?: string[];
    claudeImport: boolean;
    createdClaudeMd: boolean;
    selection: Selection | null;
    /** Every component the catalog offered at the last run, to tell new components from deselected ones. */
    offered?: Catalog;
    /** Set in memory when the file on disk is a v1 manifest. */
    migratedFrom?: 1;
}

const isScope = (value: unknown): value is Scope => value === 'global' || value === 'project';

const isMcpScope = (value: unknown): value is McpScope => value === 'user' || value === 'project';

const isFileHashes = (value: unknown): value is Record<string, string | null> =>
    isPlainObject(value) && Object.values(value).every((hash) => hash === null || typeof hash === 'string');

const isSelection = (value: unknown): value is Selection =>
    isPlainObject(value) &&
    isStringArray(value.rules) &&
    isStringArray(value.agents) &&
    isStringArray(value.skills) &&
    isStringArray(value.checks) &&
    isStringArray(value.mcp) &&
    (value.plugins === undefined || isStringArray(value.plugins));

const isCatalog = (value: unknown): value is Catalog => isSelection(value) && isStringArray(value.plugins);

/** Tells whether parsed JSON is a well-formed v2 manifest. */
export const isManifest = (value: unknown): value is Manifest =>
    isPlainObject(value) &&
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
export const shippedByV1 = (entry: OwnedEntry, templates: readonly unknown[] = LEGACY_TEMPLATES): boolean =>
    templates.some((template) => {
        const value = entry.path.reduce<unknown>((node, key) => (isPlainObject(node) ? node[key] : undefined), template);
        return entry.kind === 'value' ? deepEqual(value, entry.value) : Array.isArray(value) && value.some((item: unknown) => deepEqual(item, entry.value));
    });

/** Returns the manifest location for a config base. */
export const manifestPath = (base: string): string => path.join(base, MANIFEST_FILE);

/** Returns a manifest that owns nothing. */
export const emptyManifest = (scope: Scope, mcpScope: McpScope): Manifest => ({
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

const migrateV1Settings = (legacy: unknown): OwnedEntry[] => {
    if (!isPlainObject(legacy) || typeof legacy.wrote !== 'string' || !legacy.wrote) return [];
    try {
        const prior: unknown = typeof legacy.prior === 'string' && legacy.prior ? JSON.parse(legacy.prior) : {};
        const wrote: unknown = JSON.parse(legacy.wrote);
        if (!isPlainObject(wrote)) return [];
        return diffOwned(isPlainObject(prior) ? prior : {}, wrote).filter((entry) => shippedByV1(entry));
    } catch {
        return [];
    }
};

/**
 * Converts a v1 manifest (written by the old setup.js) to v2.
 * v1 paths were relative to the install root, so project installs carried a `.claude/` prefix.
 */
export const migrateV1 = (legacy: Record<string, unknown>): Manifest => {
    const scope: Scope = legacy.scope === 'project' ? 'project' : 'global';
    const strip = (rel: string): string => (scope === 'project' ? rel.replace(/^\.claude\//, '') : rel);
    const files = Array.isArray(legacy.files) ? legacy.files.filter((rel: unknown) => typeof rel === 'string') : [];
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
export const readManifest = (base: string): Manifest | null => {
    const file = manifestPath(base);
    const raw = readText(file);
    if (raw === null) return null;
    const data: unknown = JSON.parse(raw);
    if (!isPlainObject(data)) throw new Error(`${file} must contain a JSON object`);
    if (data.version !== 2) return migrateV1(data);
    if (!isManifest(data)) throw new Error(`${file} is not a valid v2 manifest`);
    return data;
};

/** Writes the manifest of a config base. */
export const writeManifest = (base: string, manifest: Manifest): void => writeFile(manifestPath(base), `${JSON.stringify(manifest, null, 2)}\n`);

/** Deletes the manifest of a config base. */
export const deleteManifest = (base: string): void => fs.rmSync(manifestPath(base), { force: true });
