#!/usr/bin/env node
import { spawn } from 'node:child_process';
import { realpathSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
const HEADER_END = '\r\n\r\n';
const PULL_DEBOUNCE_MS = 150;
const RELAY_ID_PREFIX = 'tsgo-relay-';
const isRecord = (value) => typeof value === 'object' && value !== null && !Array.isArray(value);
/** Splits a stream of LSP frames (`Content-Length` header + JSON body) into parsed messages. */
export const createFrameReader = (onMessage) => {
    let buffer = Buffer.alloc(0);
    return (chunk) => {
        buffer = Buffer.concat([buffer, chunk]);
        for (;;) {
            const headerEnd = buffer.indexOf(HEADER_END);
            if (headerEnd === -1)
                return;
            const header = buffer.subarray(0, headerEnd).toString('ascii');
            const length = Number(/Content-Length: *(\d+)/i.exec(header)?.[1]);
            const bodyStart = headerEnd + HEADER_END.length;
            if (!Number.isFinite(length) || buffer.length < bodyStart + length)
                return;
            const body = buffer.subarray(bodyStart, bodyStart + length).toString('utf8');
            buffer = buffer.subarray(bodyStart + length);
            const parsed = JSON.parse(body);
            if (isRecord(parsed))
                onMessage(parsed);
        }
    };
};
/** Serializes one LSP message as a frame. */
export const frame = (message) => {
    const body = JSON.stringify(message);
    return `Content-Length: ${Buffer.byteLength(body, 'utf8')}${HEADER_END}${body}`;
};
const withPullCapability = (initialize) => {
    const params = isRecord(initialize.params) ? initialize.params : {};
    const capabilities = isRecord(params.capabilities) ? params.capabilities : {};
    const textDocument = isRecord(capabilities.textDocument) ? capabilities.textDocument : {};
    return {
        ...initialize,
        params: { ...params, capabilities: { ...capabilities, textDocument: { ...textDocument, diagnostic: { dynamicRegistration: false } } } },
    };
};
const documentUri = (message) => {
    const params = isRecord(message.params) ? message.params : null;
    const textDocument = params && isRecord(params.textDocument) ? params.textDocument : null;
    return textDocument && typeof textDocument.uri === 'string' ? textDocument.uri : null;
};
/**
 * Relays LSP traffic between a client that only consumes pushed diagnostics and a server that
 * only serves pulled ones. After each document change it pulls diagnostics for every open
 * document and pushes them to the client; the server's own (empty) pushes are dropped.
 */
export const startRelay = (client, server) => {
    const openDocuments = new Set();
    const pendingPulls = new Map();
    let nextId = 0;
    let pullTimer = null;
    const toServer = (message) => {
        server.input.write(frame(message));
    };
    const toClient = (message) => {
        client.output.write(frame(message));
    };
    const pullAll = () => {
        pullTimer = null;
        for (const uri of openDocuments) {
            const id = `${RELAY_ID_PREFIX}${nextId++}`;
            pendingPulls.set(id, uri);
            toServer({ jsonrpc: '2.0', id, method: 'textDocument/diagnostic', params: { textDocument: { uri } } });
        }
    };
    const schedulePull = () => {
        if (pullTimer)
            clearTimeout(pullTimer);
        pullTimer = setTimeout(pullAll, PULL_DEBOUNCE_MS);
    };
    client.input.on('data', createFrameReader((message) => {
        const method = typeof message.method === 'string' ? message.method : null;
        const uri = documentUri(message);
        if (method === 'initialize') {
            toServer(withPullCapability(message));
            return;
        }
        toServer(message);
        if (uri && (method === 'textDocument/didOpen' || method === 'textDocument/didChange' || method === 'textDocument/didSave')) {
            openDocuments.add(uri);
            schedulePull();
        }
        else if (uri && method === 'textDocument/didClose') {
            openDocuments.delete(uri);
            toClient({ jsonrpc: '2.0', method: 'textDocument/publishDiagnostics', params: { uri, diagnostics: [] } });
            schedulePull();
        }
    }));
    server.output.on('data', createFrameReader((message) => {
        const id = typeof message.id === 'string' ? message.id : null;
        if (id !== null && pendingPulls.has(id)) {
            const uri = pendingPulls.get(id) ?? '';
            pendingPulls.delete(id);
            const result = isRecord(message.result) ? message.result : null;
            if (result && result.kind === 'full' && Array.isArray(result.items) && openDocuments.has(uri)) {
                toClient({ jsonrpc: '2.0', method: 'textDocument/publishDiagnostics', params: { uri, diagnostics: result.items } });
            }
            return;
        }
        if (message.method === 'textDocument/publishDiagnostics')
            return;
        toClient(message);
    }));
};
const spawnServer = () => process.platform === 'win32'
    ? spawn(process.env.ComSpec ?? 'cmd.exe', ['/d', '/s', '/c', 'tsc --lsp --stdio'], { stdio: 'pipe', windowsVerbatimArguments: true })
    : spawn('tsc', ['--lsp', '--stdio'], { stdio: 'pipe' });
const isEntrypoint = () => {
    const invoked = process.argv[1];
    return invoked !== undefined && realpathSync(invoked) === realpathSync(fileURLToPath(import.meta.url));
};
if (isEntrypoint()) {
    const server = spawnServer();
    server.on('error', (error) => {
        process.stderr.write(`tsgo-lsp: cannot start "tsc --lsp" (${error.message}). Install TypeScript 7: npm i -g typescript\n`);
        process.exit(1);
    });
    server.stderr.pipe(process.stderr);
    server.on('exit', (code) => process.exit(code ?? 0));
    process.stdin.on('end', () => server.kill());
    startRelay({ input: process.stdin, output: process.stdout }, { input: server.stdin, output: server.stdout });
}
