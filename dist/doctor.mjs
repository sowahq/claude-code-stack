import fs from 'node:fs';
import path from 'node:path';
import { PLUGINS } from './catalog.mjs';
import { hasImport } from './claude-md.mjs';
import { isWindows, run, which } from './exec.mjs';
import { binaryMajor } from './toolchain.mjs';
import { hashFile, readText } from './fsx.mjs';
import { color, errorMessage, log } from './log.mjs';
import { readManifest } from './manifest.mjs';
import { HOOKS_SUBDIR } from './paths.mjs';
import { isPlainObject, readSettings } from './settings.mjs';
const VALID_OUTPUT_STYLES = new Set(['default', 'Explanatory', 'Learning', 'Concise', 'Proactive']);
const DEPRECATED_KEYS = { includeCoAuthoredBy: 'use "attribution"' };
const MIN_NODE = [22, 18];
/**
 * Tells whether a Node version string meets the minimum the stack supports.
 */
export const meetsMinimumNode = (version) => {
    const [major = 0, minor = 0] = version.split('.').map(Number);
    return major > MIN_NODE[0] || (major === MIN_NODE[0] && minor >= MIN_NODE[1]);
};
/** Lists rule files whose frontmatter Claude Code ignores, which makes them load in every session. */
export const rulesWithIgnoredFrontmatter = (rulesDir) => fs.existsSync(rulesDir)
    ? fs
        .readdirSync(rulesDir)
        .filter((name) => name.endsWith('.md'))
        .filter((name) => {
        const head = readText(path.join(rulesDir, name)) ?? '';
        const frontmatter = head.match(/^---\n([\s\S]*?)\n---/)?.[1];
        return frontmatter !== undefined && /^globs:/m.test(frontmatter) && !/^paths:/m.test(frontmatter);
    })
    : [];
const groupHooks = (group) => (isPlainObject(group) && Array.isArray(group.hooks) ? group.hooks : []);
const hookArgs = (hook) => (isPlainObject(hook) && Array.isArray(hook.args) ? hook.args : []);
const findGuardArgs = (settings) => {
    const groups = isPlainObject(settings.hooks) && Array.isArray(settings.hooks.PreToolUse) ? settings.hooks.PreToolUse : [];
    return groups
        .flatMap(groupHooks)
        .map(hookArgs)
        .find((args) => args.some((arg) => String(arg).includes(`${HOOKS_SUBDIR}/guard-bash.mjs`)));
};
const requiredBinaries = (manifest) => PLUGINS.flatMap((plugin) => (plugin.binary !== undefined && manifest?.selection?.plugins?.includes(plugin.name) ? [{ name: plugin.name, binary: plugin.binary, minMajor: plugin.binaryMinMajor }] : []));
/** Collects health findings for an install target. */
export const diagnose = (target) => {
    const findings = [];
    const add = (level, message) => {
        findings.push({ level, message });
    };
    add(meetsMinimumNode(process.versions.node) ? 'ok' : 'fail', `Node.js ${process.versions.node} (hooks run with node, ${MIN_NODE.join('.')}+ required)`);
    const claude = run('claude', ['--version']);
    if (claude.missing)
        add('fail', 'Claude Code CLI not on PATH. Install: https://code.claude.com/docs/en/setup');
    else
        add('ok', `Claude Code ${claude.stdout.trim()}`);
    if (isWindows) {
        const gitBash = process.env.CLAUDE_CODE_GIT_BASH_PATH || which('bash');
        add(gitBash ? 'ok' : 'warn', gitBash ? `Git Bash: ${gitBash}` : 'Git Bash not found: Claude Code falls back to PowerShell. Install Git for Windows for the Bash tool.');
    }
    const manifest = (() => {
        try {
            return readManifest(target.base);
        }
        catch (error) {
            add('fail', `Manifest unreadable: ${errorMessage(error)}`);
            return null;
        }
    })();
    if (!manifest)
        add('warn', `Stack not installed in ${target.base}`);
    else {
        const fileCount = Object.keys(manifest.files).length;
        if (manifest.migratedFrom)
            add('warn', `Manifest v1 (${fileCount} files): run install to migrate`);
        else
            add('ok', `Manifest v2 (${fileCount} files)`);
        const drift = Object.entries(manifest.files).flatMap(([rel, hash]) => {
            const current = hashFile(path.join(target.base, rel));
            if (current === null)
                return [`${rel} missing`];
            return hash !== null && hash !== current ? [`${rel} modified`] : [];
        });
        add(drift.length ? 'warn' : 'ok', drift.length ? `Drift: ${drift.join(', ')}` : 'Installed files match the manifest');
    }
    const claudeMd = readText(path.join(target.root, 'CLAUDE.md'));
    add(hasImport(claudeMd) ? 'ok' : 'warn', hasImport(claudeMd) ? 'CLAUDE.md imports the stack' : 'CLAUDE.md does not import the stack');
    const settingsFile = path.join(target.base, 'settings.json');
    try {
        const { data } = readSettings(settingsFile);
        add('ok', 'settings.json is valid JSON');
        if (typeof data.outputStyle === 'string' && !VALID_OUTPUT_STYLES.has(data.outputStyle) && !fs.existsSync(path.join(target.base, 'output-styles'))) {
            add('warn', `outputStyle "${data.outputStyle}" is not a built-in style and silently falls back to default`);
        }
        for (const [key, hint] of Object.entries(DEPRECATED_KEYS)) {
            if (key in data)
                add('warn', `settings.json uses deprecated "${key}": ${hint}`);
        }
        const guardArgs = findGuardArgs(data);
        if (manifest?.selection?.checks.length) {
            const script = path.join(target.base, HOOKS_SUBDIR, 'guard-bash.mjs');
            add(guardArgs && fs.existsSync(script) ? 'ok' : 'fail', guardArgs ? `Bash guard registered (${String(guardArgs[1])})` : 'Bash guard is not registered in settings.json');
            add(which('node') ? 'ok' : 'fail', which('node') ? 'node is on PATH for hooks' : 'node is not on PATH: guard hooks cannot run');
        }
    }
    catch (error) {
        add('fail', `settings.json: ${errorMessage(error)}`);
    }
    for (const { name, binary, minMajor } of requiredBinaries(manifest)) {
        if (!which(binary)) {
            add('warn', `${name}: ${binary} not on PATH, the plugin has no server to talk to`);
            continue;
        }
        const major = minMajor === undefined ? null : binaryMajor(binary);
        if (minMajor !== undefined && (major === null || major < minMajor))
            add('warn', `${name}: ${binary} ${major ?? 'unknown version'} found, ${minMajor}+ required`);
        else
            add('ok', `${name}: ${binary} found`);
    }
    const legacy = rulesWithIgnoredFrontmatter(path.join(target.base, 'rules'));
    if (legacy.length)
        add('warn', `Rules with ignored "globs:" frontmatter (always loaded): ${legacy.join(', ')}`);
    return findings;
};
/** Prints the diagnosis and returns the process exit code. */
export const doctor = (target) => {
    log.step(`Doctor (${target.scope}: ${target.base})`);
    const findings = diagnose(target);
    const marks = { ok: color.green('ok  '), warn: color.yellow('warn'), fail: color.red('fail') };
    for (const { level, message } of findings)
        log.plain(`${marks[level]} ${message}`);
    return findings.some((finding) => finding.level === 'fail') ? 1 : 0;
};
