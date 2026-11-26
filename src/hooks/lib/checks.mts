import { commandsForTool, programName } from './shell.mts';
import type { Segment } from './shell.mts';

interface DenyVerdict {
    decision: 'deny';
    reason: string;
}

interface AskVerdict {
    decision: 'ask';
    reason: string;
}

export type Verdict = DenyVerdict | AskVerdict;

export type Check = (command: string, segments: Segment[]) => Verdict | null;

type ArgvCheck = (argv: string[]) => Verdict | null;

interface SplitArgs {
    flags: string[];
    positionals: string[];
}

interface GitSubcommand {
    sub: string;
    rest: string[];
}

const ATTRIBUTION_PATTERN = /Co-Authored-By:|Claude-Session:|Generated with .*Claude|claude\.ai\/code\/session/i;
const PROTECTED_BRANCHES = /^(\+)?(refs\/heads\/)?(main|master)$/;
const CATASTROPHIC_TARGETS = new Set([
    '', '~', '$home', '${home}', '.', '..', '*', '%userprofile%', '$env:userprofile',
    '/home', '/users', '/usr', '/etc', '/var', '/bin', '/sbin', '/lib', '/opt', '/system', '/library', '/applications',
    'c:', 'c:/windows', 'c:/users',
]);
const CMD_REMOVERS = new Set(['rd', 'rmdir', 'del', 'erase']);
const POWERSHELL_REMOVERS = new Set(['remove-item', 'ri']);
const FILE_READERS = new Set([
    'cat', 'tac', 'less', 'more', 'head', 'tail', 'bat', 'batcat', 'nl', 'od', 'xxd', 'hexdump', 'strings',
    'base64', 'grep', 'egrep', 'fgrep', 'rg', 'ag', 'sed', 'awk', 'cut', 'sort', 'uniq', 'diff', 'jq', 'yq',
    'cp', 'scp', 'rsync', 'open', 'code', 'vim', 'vi', 'nano', 'type', 'get-content', 'gc', 'select-string',
    'copy-item', 'cpi', 'certutil', 'openssl', 'gpg', 'findstr',
]);
const COPIERS = new Set(['cp', 'scp', 'rsync', 'copy-item', 'cpi']);
const UPLOADERS = new Set(['curl', 'wget', 'http', 'https', 'xh']);
const SAFE_ENV_SUFFIX = /\.(example|sample|template|dist|defaults?)$/i;

const deny = (reason: string): DenyVerdict => ({ decision: 'deny', reason });
const ask = (reason: string): AskVerdict => ({ decision: 'ask', reason });

const isPresent = <T,>(value: T | null | undefined): value is T => value !== null && value !== undefined;

const strongest = (verdicts: Verdict[]): Verdict | null => verdicts.find((v) => v.decision === 'deny') ?? verdicts[0] ?? null;

const normalizeTarget = (target: string): string =>
    target
        .replace(/^["']|["']$/g, '')
        .replace(/\\/g, '/')
        .replace(/(\/\*|\/\.)+$/, '')
        .replace(/\/+$/, '')
        .toLowerCase();

/**
 * Tells whether a path points to a credential or secret file.
 */
export const isSecretPath = (rawPath: string): boolean => {
    const path = rawPath.replace(/^["']|["']$/g, '').replace(/\\/g, '/');
    const base = path.split('/').pop() ?? '';
    if (/^\.env(\..+)?\*?$/i.test(base) && !SAFE_ENV_SUFFIX.test(base)) return true;
    if (/\.(pem|key|p12|pfx|jks|keystore|ppk)$/i.test(base)) return true;
    if (/^id_(rsa|dsa|ecdsa|ed25519)$/.test(base)) return true;
    if (/(^|\/)\.ssh\//.test(path) && !/\.pub$|known_hosts$/.test(base)) return true;
    if (/(^|\/)(\.aws\/credentials|\.config\/gh\/hosts\.ya?ml|\.docker\/config\.json|\.kube\/config|\.git-credentials|\.netrc|\.pgpass)$/.test(path)) return true;
    return /(^|\/)secrets\/./.test(path);
};

const splitArgs = (args: string[]): SplitArgs => {
    const flags: string[] = [];
    const positionals: string[] = [];
    let flagsDone = false;
    for (const arg of args) {
        if (!flagsDone && arg === '--') flagsDone = true;
        else if (!flagsDone && arg.startsWith('-') && arg.length > 1) flags.push(arg);
        else positionals.push(arg);
    }
    return { flags, positionals };
};

const gitSubcommand = (args: string[]): GitSubcommand => {
    let i = 0;
    for (let arg = args[i]; arg?.startsWith('-'); arg = args[i]) i += /^-(C|c)$|^--(git-dir|work-tree|namespace)$/.test(arg) ? 2 : 1;
    return { sub: args[i] ?? '', rest: args.slice(i + 1) };
};

const checkRemove: ArgvCheck = (argv) => {
    const name = programName(argv[0] ?? '');
    const args = argv.slice(1);
    if (CMD_REMOVERS.has(name)) {
        const recursive = args.some((arg) => /^\/s$/i.test(arg));
        const targets = args.filter((arg) => !/^\/[a-z]$/i.test(arg));
        return recursive && targets.some((t) => CATASTROPHIC_TARGETS.has(normalizeTarget(t)))
            ? deny(`${name} /s on a system or home folder is blocked.`)
            : null;
    }
    if (name !== 'rm' && !POWERSHELL_REMOVERS.has(name)) return null;
    const { flags, positionals } = splitArgs(args);
    if (flags.includes('--no-preserve-root')) return deny('rm --no-preserve-root is blocked.');
    const recursive = flags.some((flag) => /^--recursive$|^-rec/i.test(flag) || (/^-[a-zA-Z]{1,4}$/.test(flag) && /[rR]/.test(flag) && !/^-fo/i.test(flag)));
    if (!recursive) return null;
    const hit = positionals.find((target) => CATASTROPHIC_TARGETS.has(normalizeTarget(target)));
    return hit !== undefined ? deny(`Recursive delete of "${hit}" is blocked (root, home or system folder).`) : null;
};

const checkGit: ArgvCheck = (argv) => {
    if (programName(argv[0] ?? '') !== 'git') return null;
    const { sub, rest } = gitSubcommand(argv.slice(1));
    const { flags, positionals } = splitArgs(rest);
    if (sub === 'push') {
        const refspecs = positionals.slice(1);
        const deletesProtected = (flags.includes('--delete') || flags.includes('-d')) && refspecs.some((ref) => PROTECTED_BRANCHES.test(ref));
        if (deletesProtected || refspecs.some((ref) => /^:(refs\/heads\/)?(main|master)$/.test(ref))) {
            return deny('Deleting main/master on the remote is blocked.');
        }
        if (flags.includes('--mirror')) return deny('git push --mirror overwrites every ref on the remote.');
        const hardForce = flags.some((flag) => flag === '--force' || (/^-[a-zA-Z]+$/.test(flag) && flag.includes('f'))) || refspecs.some((ref) => ref.startsWith('+'));
        if (!hardForce) return null;
        const targetsProtected = refspecs.some((ref) => PROTECTED_BRANCHES.test(ref.split(':').pop() ?? ''));
        return targetsProtected
            ? deny('Force push to main/master is blocked. Use a branch and a pull request.')
            : ask('Force push without --force-with-lease: confirm.');
    }
    if (sub === 'reset' && flags.includes('--hard')) {
        return ask('git reset --hard discards uncommitted changes: confirm.');
    }
    if (sub === 'clean') {
        const dryRun = flags.some((flag) => flag === '--dry-run' || (/^-[a-zA-Z]+$/.test(flag) && flag.includes('n')));
        const force = flags.some((flag) => flag === '--force' || (/^-[a-zA-Z]+$/.test(flag) && flag.includes('f')));
        return force && !dryRun ? ask('git clean -f deletes untracked files: confirm.') : null;
    }
    return null;
};

const checkDisk: ArgvCheck = (argv) => {
    const name = programName(argv[0] ?? '');
    if (name.startsWith('mkfs') || name === 'format' || name === 'diskpart') {
        return deny(`${name} formate un disque.`);
    }
    if (name === 'dd' && argv.some((arg) => /^of=\/dev\/(?!(null|zero|stdout|stderr)$)/.test(arg))) {
        return deny('dd to a block device is blocked.');
    }
    return null;
};

const writesMessage = (argv: string[]): boolean => {
    const name = programName(argv[0] ?? '');
    if (name === 'git') return ['commit', 'tag'].includes(gitSubcommand(argv.slice(1)).sub);
    return name === 'gh' && argv[1] === 'pr' && /^(create|edit|merge)$/.test(argv[2] ?? '');
};

const commitTrailers: Check = (_command, segments) => {
    const attributed = segments.some(({ argv, heredocs }) => writesMessage(argv) && ATTRIBUTION_PATTERN.test([...argv, ...heredocs].join('\n')));
    return attributed
        ? deny('Commit trailers and footers are not allowed (Co-Authored-By, Claude-Session, Generated with, session links). Rewrite the message without any attribution line.')
        : null;
};

const dangerousCommands: Check = (_command, segments) =>
    strongest(
        segments
            .filter(({ argv }) => argv.length)
            .map(({ argv }) => checkRemove(argv) ?? checkGit(argv) ?? checkDisk(argv))
            .filter(isPresent),
    );

const secretReads: Check = (_command, segments) => {
    for (const { argv, redirects } of segments) {
        const redirected = redirects.find(({ op, target }) => op.startsWith('<') && op !== '<<' && op !== '<<-' && op !== '<<<' && isSecretPath(target));
        if (redirected) return deny(`Reading a secret is blocked: ${redirected.target}. Do not print it in any form, masked or partial; ask the user for what you need.`);
        const program = argv[0];
        if (program === undefined) continue;
        const name = programName(program);
        const args = argv.slice(1).filter((arg) => !arg.startsWith('-'));
        if (FILE_READERS.has(name)) {
            const sources = COPIERS.has(name) && args.length > 1 ? args.slice(0, -1) : args;
            const hit = sources.find(isSecretPath);
            if (hit) return deny(`Reading a secret is blocked: ${hit}. Do not print it in any form, masked or partial; ask the user for what you need.`);
        }
        if (UPLOADERS.has(name)) {
            const hit = argv.slice(1).find((arg) => {
                const at = arg.indexOf('@');
                return at !== -1 && isSecretPath(arg.slice(at + 1));
            });
            if (hit) return deny(`Uploading a secret file is blocked: ${hit}`);
        }
    }
    return null;
};

export const CHECKS = {
    'commit-trailers': commitTrailers,
    'dangerous-commands': dangerousCommands,
    'secret-reads': secretReads,
} satisfies Record<string, Check>;

export type CheckId = keyof typeof CHECKS;

/**
 * Tells whether an identifier names a known check.
 */
export const isCheckId = (id: string): id is CheckId => Object.hasOwn(CHECKS, id);

/**
 * Runs the selected checks against a command. A deny verdict wins over ask.
 * `toolName` is `Bash` or `PowerShell`. Unknown check ids are ignored.
 */
export const evaluateCommand = (command: string, enabled: readonly string[] = Object.keys(CHECKS), toolName = 'Bash'): Verdict | null => {
    if (!command.trim()) return null;
    const segments = commandsForTool(command, toolName);
    return strongest(
        enabled
            .filter(isCheckId)
            .map((id) => CHECKS[id](command, segments))
            .filter(isPresent),
    );
};
