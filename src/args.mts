import type { Scope } from './paths.mts';

export const COMMANDS = ['install', 'uninstall', 'doctor', 'help'] as const;

export type Command = (typeof COMMANDS)[number];

export interface CliOptions {
    command: Command;
    scope: Scope | null;
    projectDir: string;
    yes: boolean;
    dryRun: boolean;
    force: boolean;
}

export const USAGE = `Usage: claude-code-stack [command] [options]

Commands:
  install      Install or update the stack (default)
  uninstall    Remove everything the stack installed
  doctor       Check the installation and the environment

Options:
  -g, --global          Target the user config (CLAUDE_CONFIG_DIR or ~/.claude)
  -p, --project [dir]   Target a project directory (default: current directory)
  -y, --yes             Non-interactive: reuse the previous selection or defaults
  -n, --dry-run         Print the plan without changing anything
  -f, --force           Overwrite or remove files you modified (a backup is kept)
  -h, --help            Show this help`;

const isCommand = (value: string): value is Command => COMMANDS.some((command) => command === value);

/** Parses CLI arguments. */
export const parseArgs = (argv: string[], cwd: string): CliOptions => {
    const options: CliOptions = { command: 'install', scope: null, projectDir: cwd, yes: false, dryRun: false, force: false };
    for (let i = 0; i < argv.length; i++) {
        const arg = argv[i];
        if (arg === undefined) break;
        if (isCommand(arg)) options.command = arg;
        else if (arg === '-g' || arg === '--global') options.scope = 'global';
        else if (arg === '-p' || arg === '--project') {
            options.scope = 'project';
            const next = argv[i + 1];
            if (next && !next.startsWith('-') && !isCommand(next)) {
                options.projectDir = next;
                i++;
            }
        } else if (arg === '-y' || arg === '--yes') options.yes = true;
        else if (arg === '-n' || arg === '--dry-run') options.dryRun = true;
        else if (arg === '-f' || arg === '--force') options.force = true;
        else if (arg === '-h' || arg === '--help') options.command = 'help';
        else throw new Error(`Unknown argument: ${arg}\n\n${USAGE}`);
    }
    return options;
};
