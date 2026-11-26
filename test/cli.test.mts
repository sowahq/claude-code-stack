import { after, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import type { SpawnSyncReturns } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { isPlainObject } from '../src/settings.mts';

const CLI = fileURLToPath(new URL('../dist/cli.mjs', import.meta.url));
const STACK = fileURLToPath(new URL('../stack/', import.meta.url));
const scratch = fs.mkdtempSync(path.join(os.tmpdir(), 'ccs-test-'));
after(() => fs.rmSync(scratch, { recursive: true, force: true }));

const freshDir = (name: string): string => {
    const dir = path.join(scratch, name);
    fs.mkdirSync(dir, { recursive: true });
    return dir;
};

const isolatedEnv = (configDir: string): NodeJS.ProcessEnv => ({
    ...Object.fromEntries(Object.entries(process.env).filter(([key]) => key.toUpperCase() !== 'PATH')),
    CLAUDE_CONFIG_DIR: configDir,
    PATH: path.dirname(process.execPath),
    NO_COLOR: '1',
});

const cli = (configDir: string, ...args: string[]): SpawnSyncReturns<string> => spawnSync(process.execPath, [CLI, ...args], { encoding: 'utf8', env: isolatedEnv(configDir) });

const readJson = (file: string): unknown => JSON.parse(fs.readFileSync(file, 'utf8'));

const get = (value: unknown, ...keys: (string | number)[]): unknown =>
    keys.reduce<unknown>((node, key) => {
        if (typeof key === 'number') return Array.isArray(node) ? node[key] : undefined;
        return isPlainObject(node) ? node[key] : undefined;
    }, value);

const list = (value: unknown): unknown[] => {
    assert.ok(Array.isArray(value), `expected an array, got ${JSON.stringify(value)}`);
    return value;
};

const text = (value: unknown): string => {
    assert.ok(typeof value === 'string', `expected a string, got ${JSON.stringify(value)}`);
    return value;
};

const snapshot = (dir: string): [string, string][] =>
    fs
        .readdirSync(dir, { recursive: true, withFileTypes: true })
        .filter((entry) => entry.isFile())
        .map((entry) => path.join(entry.parentPath, entry.name))
        .filter((file) => !file.includes('.claude-code-stack'))
        .sort()
        .map((file): [string, string] => [path.relative(dir, file), fs.readFileSync(file, 'utf8')]);

describe('cli install/uninstall (global)', () => {
    const dir = freshDir('global');
    const userSettings = { language: 'English', model: 'opus', permissions: { allow: ['Bash(ls)'] }, hooks: { Stop: [{ hooks: [{ type: 'command', command: 'say done' }] }] } };
    fs.writeFileSync(path.join(dir, 'settings.json'), JSON.stringify(userSettings));
    fs.writeFileSync(path.join(dir, 'CLAUDE.md'), '@RTK.md\n');

    it('installs everything with --yes', () => {
        const result = cli(dir, 'install', '--global', '--yes');
        assert.equal(result.status, 0, result.stderr + result.stdout);
        const settings = readJson(path.join(dir, 'settings.json'));
        assert.equal(get(settings, 'language'), 'English');
        assert.ok(list(get(settings, 'permissions', 'allow')).includes('Bash(ls)'));
        assert.ok(list(get(settings, 'permissions', 'allow')).includes('Bash(go test *)'));
        const guard = list(get(settings, 'hooks', 'PreToolUse')).find((group) => get(group, 'hooks', 0, 'command') === 'node');
        assert.ok(text(get(guard, 'hooks', 0, 'args', 0)).endsWith('/hooks/claude-code-stack/guard-bash.mjs'));
        assert.equal(get(guard, 'hooks', 0, 'args', 1), 'commit-trailers,dangerous-commands,secret-reads');
        assert.deepEqual(get(settings, 'hooks', 'Stop'), userSettings.hooks.Stop);
        assert.ok(fs.existsSync(path.join(dir, 'rules', 'golang.md')));
        assert.ok(fs.existsSync(path.join(dir, 'skills', 'todoist', 'SKILL.md')));
        assert.ok(fs.existsSync(path.join(dir, 'hooks', 'claude-code-stack', 'lib', 'shell.mjs')));
        assert.match(fs.readFileSync(path.join(dir, 'CLAUDE.md'), 'utf8'), /^@RTK\.md\n\n<!-- BEGIN claude-code-stack/);
        assert.equal(get(readJson(path.join(dir, '.claude-code-stack-manifest.json')), 'version'), 2);
    });

    it('installed guard blocks a dangerous command', () => {
        const script = path.join(dir, 'hooks', 'claude-code-stack', 'guard-bash.mjs');
        const result = spawnSync(process.execPath, [script, 'dangerous-commands'], { input: JSON.stringify({ tool_input: { command: 'rm -rf ~' } }), encoding: 'utf8' });
        assert.equal(get(JSON.parse(result.stdout), 'hookSpecificOutput', 'permissionDecision'), 'deny');
    });

    it('is idempotent', () => {
        const before = snapshot(dir);
        const result = cli(dir, 'install', '--global', '--yes');
        assert.equal(result.status, 0, result.stderr);
        assert.match(result.stdout, /Already up to date/);
        assert.deepEqual(snapshot(dir), before);
    });

    it('keeps a rule the user edited', () => {
        const rule = path.join(dir, 'rules', 'golang.md');
        fs.appendFileSync(rule, '\n- my own rule\n');
        const result = cli(dir, 'install', '--global', '--yes');
        assert.match(result.stdout, /rules\/golang\.md: skip \(you modified it/);
        assert.match(fs.readFileSync(rule, 'utf8'), /my own rule/);
    });

    it('dry-run changes nothing', () => {
        const before = snapshot(dir);
        const result = cli(dir, 'uninstall', '--global', '--dry-run');
        assert.equal(result.status, 0, result.stderr);
        assert.match(result.stdout, /Dry run/);
        assert.deepEqual(snapshot(dir), before);
    });

    it('uninstall restores the user config', () => {
        const result = cli(dir, 'uninstall', '--global', '--yes');
        assert.equal(result.status, 0, result.stderr);
        assert.deepEqual(readJson(path.join(dir, 'settings.json')), userSettings);
        assert.equal(fs.readFileSync(path.join(dir, 'CLAUDE.md'), 'utf8'), '@RTK.md\n');
        assert.ok(!fs.existsSync(path.join(dir, 'agents')));
        assert.ok(fs.existsSync(path.join(dir, 'rules', 'golang.md')), 'edited rule is kept');
        assert.ok(!fs.existsSync(path.join(dir, '.claude-code-stack-manifest.json')));
    });
});

describe('cli migrates a v1 install', () => {
    const dir = freshDir('v1');
    const legacyHook = { matcher: 'Bash', hooks: [{ type: 'command', command: "sh -c 'exec \"$HOME/.claude/hooks/block-commit-trailers.sh\"'", timeout: 10 }] };
    const prior = { model: 'opus', permissions: { allow: ['Bash(ls)'] } };
    const wrote = { ...prior, effortLevel: 'high', outputStyle: 'tui', permissions: { allow: ['Bash(ls)', 'Bash(make *)', 'Bash(pnpm *)'] }, hooks: { PreToolUse: [legacyHook] } };
    fs.writeFileSync(path.join(dir, 'settings.json'), JSON.stringify({ ...wrote, voiceEnabled: true }));
    fs.mkdirSync(path.join(dir, 'rules'), { recursive: true });
    fs.mkdirSync(path.join(dir, 'hooks'), { recursive: true });
    fs.writeFileSync(path.join(dir, 'rules', 'project-memory.md'), '# Project Memory\n');
    fs.writeFileSync(path.join(dir, 'rules', 'todoist.md'), '# Todoist Rules\n');
    fs.writeFileSync(path.join(dir, 'rules', 'golang.md'), '---\nglobs: ["**/*.go"]\n---\n# old\n');
    fs.writeFileSync(path.join(dir, 'hooks', 'block-commit-trailers.sh'), "#!/bin/sh\npattern='Co-Authored-By:|Co-authored-by:|Claude-Session:|Generated with .*Claude'\n");
    fs.writeFileSync(path.join(dir, 'CLAUDE.md'), '@RTK.md\n\n<!-- BEGIN claude-code-stack (managed, do not edit) -->\n@claude-code-stack.md\n<!-- END claude-code-stack -->\n');
    fs.writeFileSync(
        path.join(dir, '.claude-code-stack-manifest.json'),
        JSON.stringify({ scope: 'global', version: 1, files: ['claude-code-stack.md', 'rules/golang.md', 'rules/project-memory.md', 'rules/todoist.md'], mcp: [], mcpScope: 'user', settings: { existed: true, prior: JSON.stringify(prior), wrote: JSON.stringify(wrote) }, claudeImport: true, createdClaudeMd: false }),
    );

    it('cleans legacy entries and adopts the install', () => {
        const result = cli(dir, 'install', '--global', '--yes');
        assert.equal(result.status, 0, result.stderr + result.stdout);
        const settings = readJson(path.join(dir, 'settings.json'));
        const allow = list(get(settings, 'permissions', 'allow'));
        assert.equal(get(settings, 'outputStyle'), undefined);
        assert.equal(get(settings, 'voiceEnabled'), true);
        assert.equal(get(settings, 'effortLevel'), 'high', 'keys added by the user between v1 runs stay');
        assert.ok(allow.includes('Bash(make *)'));
        assert.ok(!allow.includes('Bash(pnpm *)'));
        assert.ok(allow.includes('Bash(ls)'));
        assert.ok(!String(JSON.stringify(get(settings, 'hooks'))).includes('block-commit-trailers.sh'));
        assert.ok(!fs.existsSync(path.join(dir, 'rules', 'project-memory.md')));
        assert.ok(!fs.existsSync(path.join(dir, 'hooks', 'block-commit-trailers.sh')));
        assert.equal(fs.readFileSync(path.join(dir, 'rules', 'golang.md'), 'utf8'), fs.readFileSync(path.join(STACK, 'rules', 'golang.md'), 'utf8'));
        const manifest = readJson(path.join(dir, '.claude-code-stack-manifest.json'));
        assert.equal(get(manifest, 'version'), 2);
        assert.ok(list(get(manifest, 'selection', 'rules')).includes('golang'));
        assert.ok(!list(get(manifest, 'selection', 'rules')).includes('rust'));
        assert.deepEqual(get(manifest, 'selection', 'skills'), ['todoist']);
        assert.ok(fs.existsSync(path.join(dir, 'skills', 'todoist', 'SKILL.md')));
        assert.ok(!fs.existsSync(path.join(dir, 'rules', 'todoist.md')));
        assert.ok(fs.readdirSync(path.join(dir, '.claude-code-stack', 'backups')).length === 1);
    });
});

describe('cli project scope', () => {
    const project = freshDir('project');
    const config = freshDir('project-config');

    it('installs into .claude with a CLAUDE_PROJECT_DIR hook path', () => {
        const result = spawnSync(process.execPath, [CLI, 'install', '--project', project, '--yes'], { encoding: 'utf8', env: isolatedEnv(config) });
        assert.equal(result.status, 0, result.stderr + result.stdout);
        const settings = readJson(path.join(project, '.claude', 'settings.json'));
        assert.equal(get(settings, 'hooks', 'PreToolUse', 0, 'hooks', 0, 'args', 0), '${CLAUDE_PROJECT_DIR}/.claude/hooks/claude-code-stack/guard-bash.mjs');
        assert.match(fs.readFileSync(path.join(project, 'CLAUDE.md'), 'utf8'), /@\.claude\/claude-code-stack\.md/);
        assert.deepEqual(fs.readdirSync(config), []);
    });
});

const fakeClaudeBin = (): string => {
    const bin = freshDir('fake-bin');
    const script = fileURLToPath(new URL('./fixtures/fake-claude.mts', import.meta.url));
    if (process.platform === 'win32') {
        fs.writeFileSync(path.join(bin, 'claude.cmd'), `@"${process.execPath}" "${script}" %*\r\n`);
    } else {
        fs.writeFileSync(path.join(bin, 'claude'), `#!/bin/sh\nexec "${process.execPath}" "${script}" "$@"\n`, { mode: 0o755 });
    }
    return bin;
};

describe('cli plugins (fake claude CLI)', () => {
    const dir = freshDir('plugins');
    const bin = fakeClaudeBin();
    const logFile = path.join(scratch, 'fake-claude.log');
    const installed = [
        { id: 'i-have-adhd@i-have-adhd', scope: 'user', enabled: true },
        { id: 'frontend-design@claude-plugins-official', scope: 'local', enabled: false },
    ];
    const env = (): NodeJS.ProcessEnv => ({
        ...isolatedEnv(dir),
        PATH: [bin, path.dirname(process.execPath)].join(path.delimiter),
        FAKE_CLAUDE_LOG: logFile,
        FAKE_CLAUDE_PLUGINS: JSON.stringify(installed),
    });
    const calls = (): string[][] =>
        fs.existsSync(logFile)
            ? fs
                  .readFileSync(logFile, 'utf8')
                  .trim()
                  .split('\n')
                  .map((line) => list(JSON.parse(line)).map(text))
            : [];
    const run = (...args: string[]): SpawnSyncReturns<string> => {
        fs.rmSync(logFile, { force: true });
        return spawnSync(process.execPath, [CLI, ...args], { encoding: 'utf8', env: env() });
    };

    it('installs missing plugins and turns i-have-adhd always on', () => {
        const result = run('install', '--global', '--yes');
        assert.equal(result.status, 0, result.stderr + result.stdout);
        const installs = calls().filter((argv) => argv[0] === 'plugin' && argv[1] === 'install');
        assert.deepEqual(installs.map((argv) => argv[2]).sort(), ['frontend-design', 'gopls-lsp', 'rust-analyzer-lsp', 'typescript-lsp']);
        for (const argv of installs) assert.deepEqual(argv.slice(3), ['--marketplace', 'anthropics/claude-plugins-official', '--scope', 'user', '--yes']);
        assert.ok(fs.existsSync(path.join(dir, '.i-have-adhd-always')));
        const manifest = readJson(path.join(dir, '.claude-code-stack-manifest.json'));
        assert.deepEqual([...list(get(manifest, 'plugins'))].sort(), ['frontend-design', 'gopls-lsp', 'rust-analyzer-lsp', 'typescript-lsp']);
    });

    it('uninstalls only the plugins it installed', () => {
        const result = run('uninstall', '--global', '--yes');
        assert.equal(result.status, 0, result.stderr + result.stdout);
        const removed = calls().filter((argv) => argv[0] === 'plugin' && argv[1] === 'uninstall').map((argv) => argv[2]).sort();
        assert.deepEqual(removed, ['frontend-design@claude-plugins-official', 'gopls-lsp@claude-plugins-official', 'rust-analyzer-lsp@claude-plugins-official', 'typescript-lsp@claude-plugins-official']);
        assert.ok(!fs.existsSync(path.join(dir, '.i-have-adhd-always')));
    });
});

describe('cli keeps stack MCP servers when the Claude CLI is missing', () => {
    it('does not forget owned servers', () => {
        const dir = freshDir('mcp-missing-cli');
        assert.equal(cli(dir, 'install', '--global', '--yes').status, 0);
        const manifestFile = path.join(dir, '.claude-code-stack-manifest.json');
        const manifest = readJson(manifestFile);
        assert.ok(isPlainObject(manifest) && isPlainObject(manifest.selection));
        manifest.mcp = ['svelte'];
        manifest.selection.mcp = ['svelte'];
        fs.writeFileSync(manifestFile, JSON.stringify(manifest));
        fs.rmSync(path.join(dir, 'rules', 'golang.md'));
        const result = cli(dir, 'install', '--global', '--yes');
        assert.equal(result.status, 0, result.stderr + result.stdout);
        const after = readJson(manifestFile);
        assert.deepEqual(get(after, 'mcp'), ['svelte']);
        assert.deepEqual(get(after, 'selection', 'mcp'), ['svelte']);
        assert.ok(fs.existsSync(path.join(dir, 'rules', 'golang.md')));
    });
});

describe('cli doctor', () => {
    it('flags ignored globs frontmatter and invalid outputStyle', () => {
        const dir = freshDir('doctor');
        fs.mkdirSync(path.join(dir, 'rules'));
        fs.writeFileSync(path.join(dir, 'rules', 'go.md'), '---\nglobs: ["**/*.go"]\n---\n');
        fs.writeFileSync(path.join(dir, 'settings.json'), JSON.stringify({ outputStyle: 'tui', includeCoAuthoredBy: false }));
        const result = cli(dir, 'doctor');
        assert.match(result.stdout, /ignored "globs:" frontmatter.*go\.md/);
        assert.match(result.stdout, /outputStyle "tui"/);
        assert.match(result.stdout, /deprecated "includeCoAuthoredBy"/);
    });
});
