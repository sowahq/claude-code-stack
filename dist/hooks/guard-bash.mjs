#!/usr/bin/env node
import { readFileSync } from 'node:fs';
import { CHECKS, evaluateCommand, isCheckId } from './lib/checks.mjs';
const isRecord = (value) => typeof value === 'object' && value !== null;
/**
 * Reads the hook payload from stdin. Returns null when it is not valid JSON.
 */
const readPayload = () => {
    try {
        const parsed = JSON.parse(readFileSync(0, 'utf8'));
        return parsed;
    }
    catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        process.stderr.write(`guard-bash: invalid hook payload (${message})\n`);
        return null;
    }
};
const commandOf = (payload) => {
    if (!isRecord(payload) || !isRecord(payload['tool_input']))
        return null;
    const command = payload['tool_input']['command'];
    return typeof command === 'string' ? command : null;
};
const toolNameOf = (payload) => {
    const toolName = isRecord(payload) ? payload['tool_name'] : undefined;
    return typeof toolName === 'string' ? toolName : 'Bash';
};
const enabledChecks = (arg) => {
    const requested = (arg ?? '').split(',').map((id) => id.trim()).filter(Boolean);
    return requested.length ? requested.filter(isCheckId) : Object.keys(CHECKS);
};
const main = () => {
    const payload = readPayload();
    const command = commandOf(payload);
    if (command === null)
        return;
    const verdict = evaluateCommand(command, enabledChecks(process.argv[2]), toolNameOf(payload));
    if (!verdict)
        return;
    process.stdout.write(JSON.stringify({
        hookSpecificOutput: {
            hookEventName: 'PreToolUse',
            permissionDecision: verdict.decision,
            permissionDecisionReason: verdict.reason,
        },
    }));
};
main();
