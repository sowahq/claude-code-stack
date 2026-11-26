import { after, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { createFrameReader, frame } from '../plugins/tsgo-lsp/src/relay.mts';

type Message = Record<string, unknown>;

const RELAY = fileURLToPath(new URL('../plugins/tsgo-lsp/bin/relay.mjs', import.meta.url));
const LOCAL_BIN = fileURLToPath(new URL('../node_modules/.bin', import.meta.url));
const project = fs.mkdtempSync(path.join(os.tmpdir(), 'tsgo-relay-'));
after(() => fs.rmSync(project, { recursive: true, force: true }));

fs.mkdirSync(path.join(project, 'src'));
fs.writeFileSync(path.join(project, 'tsconfig.json'), JSON.stringify({ compilerOptions: { strict: true, module: 'nodenext', target: 'es2023', noEmit: true }, include: ['src'] }));
const fileUri = pathToFileURL(path.join(project, 'src', 'index.ts')).href;
const BROKEN = 'const label: string = 42;\nexport { label };\n';
const FIXED = 'const label: string = "42";\nexport { label };\n';

const isRecord = (value: unknown): value is Message => typeof value === 'object' && value !== null && !Array.isArray(value);

const diagnosticCodes = (message: Message): string[] => {
    const params = isRecord(message.params) ? message.params : {};
    const diagnostics = Array.isArray(params.diagnostics) ? params.diagnostics : [];
    return diagnostics.filter(isRecord).map((diagnostic) => `TS${String(diagnostic.code)}`);
};

describe('frame reader', () => {
    it('reassembles frames split across chunks and keeps multibyte text intact', () => {
        const received: Message[] = [];
        const read = createFrameReader((message) => received.push(message));
        const bytes = Buffer.from(frame({ text: 'é' }) + frame({ n: 2 }), 'utf8');
        read(bytes.subarray(0, 7));
        read(bytes.subarray(7, 30));
        read(bytes.subarray(30));
        assert.deepEqual(received, [{ text: 'é' }, { n: 2 }]);
    });
});

describe('tsgo-lsp relay against the real TypeScript 7 server', () => {
    it('pushes pulled diagnostics after open and clears them after a fix', async () => {
        const relay = spawn(process.execPath, [RELAY], { cwd: project, env: { ...process.env, PATH: [LOCAL_BIN, process.env.PATH ?? ''].join(path.delimiter) } });
        const pushes: Message[] = [];
        let waiter: { codes: (codes: string[]) => boolean; resolve: (codes: string[]) => void } | null = null;
        const send = (message: Message): void => {
            relay.stdin.write(frame({ jsonrpc: '2.0', ...message }));
        };
        relay.stdout.on('data', createFrameReader((message) => {
            if (typeof message.method === 'string' && message.id !== undefined) {
                send({ id: message.id, result: message.method === 'workspace/configuration' ? [] : null });
                return;
            }
            if (message.id === 1) {
                send({ method: 'initialized', params: {} });
                send({ method: 'textDocument/didOpen', params: { textDocument: { uri: fileUri, languageId: 'typescript', version: 1, text: BROKEN } } });
                return;
            }
            if (message.method !== 'textDocument/publishDiagnostics') return;
            pushes.push(message);
            const codes = diagnosticCodes(message);
            if (waiter && waiter.codes(codes)) {
                const { resolve } = waiter;
                waiter = null;
                resolve(codes);
            }
        }));
        const nextPush = (accept: (codes: string[]) => boolean): Promise<string[]> =>
            new Promise((resolve, reject) => {
                const timer = setTimeout(() => reject(new Error(`no matching push, received: ${JSON.stringify(pushes.map(diagnosticCodes))}`)), 20000);
                waiter = { codes: accept, resolve: (codes) => { clearTimeout(timer); resolve(codes); } };
            });

        try {
            const broken = nextPush((codes) => codes.length > 0);
            send({ id: 1, method: 'initialize', params: { processId: process.pid, rootUri: pathToFileURL(project).href, capabilities: { textDocument: { publishDiagnostics: {} } } } });
            assert.deepEqual(await broken, ['TS2322']);

            const fixed = nextPush((codes) => codes.length === 0);
            send({ method: 'textDocument/didChange', params: { textDocument: { uri: fileUri, version: 2 }, contentChanges: [{ text: FIXED }] } });
            assert.deepEqual(await fixed, []);
        } finally {
            relay.kill();
        }
    });
});
