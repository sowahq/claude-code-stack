#!/usr/bin/env node
import { readFileSync } from 'node:fs';
import { CHECKS, evaluateCommand, isCheckId } from './lib/checks.mts';

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null;

/**
 * Reads the hook payload from stdin. Returns null when it is not valid JSON.
 */
const readPayload = (): unknown => {
    try {
        const parsed: unknown = JSON.parse(readFileSync(0, 'utf8'));
        return parsed;
    } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        process.stderr.write(`guard-bash: invalid hook payload (${message})\n`);
        return null;
    }
};

const commandOf = (payload: unknown): string | null => {
    if (!isRecord(payload) || !isRecord(payload['tool_input'])) return null;
    const command = payload['tool_input']['command'];
    return typeof command === 'string' ? command : null;
};

const toolNameOf = (payload: unknown): string => {
    const toolName = isRecord(payload) ? payload['tool_name'] : undefined;
    return typeof toolName === 'string' ? toolName : 'Bash';
};

const enabledChecks = (arg: string | undefined): string[] => {
    const requested = (arg ?? '').split(',').map((id) => id.trim()).filter(Boolean);
    return requested.length ? requested.filter(isCheckId) : Object.keys(CHECKS);
};

const main = (): void => {
    const payload = readPayload();
    const command = commandOf(payload);
    if (command === null) return;
    const verdict = evaluateCommand(command, enabledChecks(process.argv[2]), toolNameOf(payload));
    if (!verdict) return;
    process.stdout.write(
        JSON.stringify({
            hookSpecificOutput: {
                hookEventName: 'PreToolUse',
                permissionDecision: verdict.decision,
                permissionDecisionReason: verdict.reason,
            },
        }),
    );
};

main();
