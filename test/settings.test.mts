import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { buildSettingsTemplate, deepEqual, diffOwned, guardHookEntry, isPlainObject, mergeOwned, removeOwned } from '../src/settings.mts';
import { stripLegacyHooks } from '../src/plan.mts';
import { withImport, withoutImport, BLOCK_BEGIN } from '../src/claude-md.mts';
import { addArgs } from '../src/mcp.mts';
import { withNewComponents } from '../src/catalog.mts';
import type { Catalog, McpServer, Selection } from '../src/catalog.mts';
import { parseArgs } from '../src/args.mts';
import type { CliOptions } from '../src/args.mts';
import { resolveTarget } from '../src/paths.mts';
import { meetsMinimumNode } from '../src/doctor.mts';

describe('mergeOwned / removeOwned', () => {
    const cases = [
        {
            name: 'adds missing keys and keeps user values',
            base: { language: 'English', permissions: { allow: ['Bash(ls)'] } },
            template: { language: 'French', spinnerTipsEnabled: false, permissions: { allow: ['Bash(ls)', 'Bash(go test *)'] } },
            want: { language: 'English', spinnerTipsEnabled: false, permissions: { allow: ['Bash(ls)', 'Bash(go test *)'] } },
            owned: 2,
        },
        {
            name: 'does not replace a value of another type',
            base: { env: 'oops' },
            template: { env: { A: '1' } },
            want: { env: 'oops' },
            owned: 0,
        },
        {
            name: 'dedupes object array items structurally',
            base: { hooks: { PreToolUse: [{ matcher: 'Bash', hooks: [{ command: 'x', type: 'command' }] }] } },
            template: { hooks: { PreToolUse: [{ hooks: [{ type: 'command', command: 'x' }], matcher: 'Bash' }] } },
            want: { hooks: { PreToolUse: [{ matcher: 'Bash', hooks: [{ command: 'x', type: 'command' }] }] } },
            owned: 0,
        },
    ];
    for (const { name, base, template, want, owned } of cases) {
        it(name, () => {
            const merged = mergeOwned(base, template);
            assert.deepEqual(merged.result, want);
            assert.equal(merged.owned.length, owned);
            assert.ok(deepEqual(removeOwned(merged.result, merged.owned).result, base));
        });
    }

    it('keeps entries the user changed after install', () => {
        const merged = mergeOwned({}, { outputStyle: 'Concise', permissions: { deny: ['Read(.env)'] } });
        merged.result.outputStyle = 'Explanatory';
        const { result, kept } = removeOwned(merged.result, merged.owned);
        assert.deepEqual(result, { outputStyle: 'Explanatory' });
        assert.deepEqual(kept.map((entry) => entry.path.join('.')), ['outputStyle']);
    });

    it('does not mutate its inputs', () => {
        const base = { permissions: { allow: ['a'] } };
        mergeOwned(base, { permissions: { allow: ['b'] } });
        assert.deepEqual(base, { permissions: { allow: ['a'] } });
    });
});

describe('diffOwned', () => {
    it('recovers what a v1 install added', () => {
        const prior = { model: 'opus', permissions: { allow: ['Bash(ls)'] } };
        const wrote = { model: 'opus', outputStyle: 'tui', permissions: { allow: ['Bash(ls)', 'Bash(pnpm *)'] } };
        assert.deepEqual(diffOwned(prior, wrote), [
            { kind: 'value', path: ['outputStyle'], value: 'tui' },
            { kind: 'item', path: ['permissions', 'allow'], value: 'Bash(pnpm *)' },
        ]);
    });
});

describe('buildSettingsTemplate', () => {
    const target = resolveTarget('global', '.', { CLAUDE_CONFIG_DIR: '/tmp/cfg' });
    const cases = [
        { checks: [], hasHook: false },
        { checks: ['commit-trailers', 'secret-reads'], hasHook: true },
    ];
    for (const { checks, hasHook } of cases) {
        it(`checks=${checks.join(',') || 'none'}`, () => {
            const template = buildSettingsTemplate(target, { checks });
            const hooks = isPlainObject(template.hooks) ? template.hooks : {};
            const entries: unknown[] = Array.isArray(hooks.PreToolUse) ? hooks.PreToolUse : [];
            assert.equal(entries.some((entry) => deepEqual(entry, guardHookEntry(target.guardScript, checks))), hasHook);
            assert.equal(template.outputStyle, undefined);
        });
    }
});

describe('stripLegacyHooks', () => {
    it('removes the v1 bash hook and keeps others', () => {
        const legacy = { matcher: 'Bash', hooks: [{ type: 'command', command: "sh -c 'for p in \"$HOME/.claude/hooks/block-commit-trailers.sh\"; do exec \"$p\"; done'" }] };
        const other = { matcher: 'Bash', hooks: [{ type: 'command', command: '/x/rtk-rewrite.sh' }] };
        assert.deepEqual(stripLegacyHooks({ hooks: { PreToolUse: [legacy, other] } }), { hooks: { PreToolUse: [other] } });
        assert.deepEqual(stripLegacyHooks({ hooks: { PreToolUse: [legacy] } }), {});
    });
});

describe('CLAUDE.md import block', () => {
    const cases = [
        { name: 'creates when missing', input: null },
        { name: 'appends to user content', input: '@RTK.md\n' },
        { name: 'replaces an existing block', input: `@RTK.md\n\n${BLOCK_BEGIN}\n@old.md\n<!-- END claude-code-stack -->\n` },
    ];
    for (const { name, input } of cases) {
        it(name, () => {
            const next = withImport(input, 'claude-code-stack.md');
            assert.equal(next.split(BLOCK_BEGIN).length, 2);
            assert.ok(next.includes('@claude-code-stack.md'));
            assert.equal(withImport(next, 'claude-code-stack.md'), next);
            const removed = withoutImport(next);
            assert.equal(removed, input?.includes('@RTK.md') ? '@RTK.md\n' : null);
        });
    }
});

describe('CLAUDE.md damaged block', () => {
    const cases = [
        { name: 'missing END marker', input: `${BLOCK_BEGIN}\n@claude-code-stack.md\n## My notes\n` },
        { name: 'two BEGIN markers', input: `${BLOCK_BEGIN}\n${BLOCK_BEGIN}\n@x.md\n<!-- END claude-code-stack -->\n` },
        { name: 'user text inside the block', input: `${BLOCK_BEGIN}\n@x.md\n## My notes\n<!-- END claude-code-stack -->\n` },
    ];
    for (const { name, input } of cases) {
        it(name, () => {
            assert.throws(() => withImport(input, 'claude-code-stack.md'), /damaged/);
            assert.throws(() => withoutImport(input), /damaged/);
        });
    }
    it('accepts CRLF line endings', () => {
        const crlf = `@RTK.md\r\n\r\n${BLOCK_BEGIN}\r\n@claude-code-stack.md\r\n<!-- END claude-code-stack -->\r\n`;
        assert.ok(!withoutImport(crlf)?.includes(BLOCK_BEGIN));
    });
});

describe('mcp addArgs', () => {
    const svelte: McpServer = { name: 'svelte', label: '', match: '', transport: 'stdio', command: ['npx', '-y', '@sveltejs/mcp'] };
    const todoist: McpServer = { name: 'todoist', label: '', match: '', transport: 'http', url: 'https://ai.todoist.net/mcp' };
    const cases = [
        { server: svelte, windows: false, want: ['mcp', 'add', '--scope', 'user', 'svelte', '--', 'npx', '-y', '@sveltejs/mcp'] },
        { server: svelte, windows: true, want: ['mcp', 'add', '--scope', 'user', 'svelte', '--', 'cmd', '/c', 'npx', '-y', '@sveltejs/mcp'] },
        { server: todoist, windows: true, want: ['mcp', 'add', '--transport', 'http', '--scope', 'user', 'todoist', 'https://ai.todoist.net/mcp'] },
    ];
    for (const { server, windows, want } of cases) {
        it(`${server.name} windows=${windows}`, () => assert.deepEqual(addArgs(server, 'user', windows), want));
    }
});

describe('parseArgs', () => {
    const cases: { argv: string[]; want: Partial<CliOptions> }[] = [
        { argv: [], want: { command: 'install', scope: null, projectDir: '/cwd' } },
        { argv: ['uninstall', '-g', '-y'], want: { command: 'uninstall', scope: 'global', yes: true } },
        { argv: ['--project', 'app', '--dry-run'], want: { scope: 'project', projectDir: 'app', dryRun: true } },
        { argv: ['-p', 'doctor'], want: { scope: 'project', projectDir: '/cwd', command: 'doctor' } },
    ];
    for (const { argv, want } of cases) {
        it(argv.join(' ') || '(none)', () => {
            const parsed = new Map(Object.entries(parseArgs(argv, '/cwd')));
            for (const [key, value] of Object.entries(want)) assert.equal(parsed.get(key), value);
        });
    }
    it('rejects unknown flags', () => assert.throws(() => parseArgs(['--nope'], '/cwd'), /Unknown argument/));
});

describe('resolveTarget', () => {
    it('global honours CLAUDE_CONFIG_DIR and uses forward slashes', () => {
        const target = resolveTarget('global', '.', { CLAUDE_CONFIG_DIR: '/tmp/cfg' });
        assert.equal(target.importPath, 'claude-code-stack.md');
        assert.ok(target.guardScript.endsWith('/hooks/claude-code-stack/guard-bash.mjs'));
        assert.ok(!target.guardScript.includes('\\'));
    });
    it('project uses CLAUDE_PROJECT_DIR in the hook path', () => {
        const target = resolveTarget('project', '/repo');
        assert.equal(target.guardScript, '${CLAUDE_PROJECT_DIR}/.claude/hooks/claude-code-stack/guard-bash.mjs');
        assert.equal(target.mcpScope, 'project');
    });
});

describe('meetsMinimumNode', () => {
    const cases: ReadonlyArray<{ version: string; want: boolean }> = [
        { version: '20.19.0', want: false },
        { version: '22.17.1', want: false },
        { version: '22.18.0', want: true },
        { version: '24.0.0', want: true },
    ];
    for (const { version, want } of cases) {
        it(`${version} -> ${want}`, (): void => assert.equal(meetsMinimumNode(version), want));
    }
});

describe('withNewComponents', () => {
    const catalog: Catalog = {
        rules: ['clean-code', 'golang', 'rust'],
        agents: ['go-reviewer'],
        skills: ['atomic-commit', 'todoist'],
        checks: ['commit-trailers'],
        mcp: ['svelte'],
        plugins: ['gopls-lsp'],
    };
    const previous: Selection = { rules: ['golang', 'dry'], agents: [], skills: ['atomic-commit'], checks: [], mcp: ['svelte', 'gone'], plugins: [] };

    it('adds components the user was never offered and drops removed ones', (): void => {
        const offered: Catalog = { rules: ['golang', 'rust', 'dry'], agents: ['go-reviewer'], skills: ['atomic-commit'], checks: ['commit-trailers'], mcp: ['svelte'], plugins: ['gopls-lsp'] };
        assert.deepEqual(withNewComponents(previous, catalog, offered), {
            rules: ['golang', 'clean-code'],
            agents: [],
            skills: ['atomic-commit', 'todoist'],
            checks: [],
            mcp: ['svelte'],
            plugins: [],
        });
    });

    it('uses the v1 catalog as baseline when nothing was recorded', (): void => {
        const result = withNewComponents(previous, catalog, null);
        assert.deepEqual(result.rules, ['golang', 'clean-code']);
        assert.deepEqual(result.checks, ['commit-trailers']);
        assert.deepEqual(result.plugins, ['gopls-lsp']);
    });
});
