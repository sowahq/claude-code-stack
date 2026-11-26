import fs from 'node:fs';

const args = process.argv.slice(2);
if (process.env.FAKE_CLAUDE_LOG) fs.appendFileSync(process.env.FAKE_CLAUDE_LOG, `${JSON.stringify(args)}\n`);

const command = args.join(' ');
if (command === '--version') process.stdout.write('9.9.9 (Claude Code)\n');
else if (command === 'plugin list --json') process.stdout.write(process.env.FAKE_CLAUDE_PLUGINS ?? '[]');
else if (command === 'mcp list') process.stdout.write(process.env.FAKE_CLAUDE_MCP ?? 'No MCP servers configured.\n');
