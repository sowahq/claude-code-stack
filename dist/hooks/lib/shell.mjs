const REDIRECT_START = new Set(['>', '<']);
const WRAPPER_SHELLS = new Set(['sh', 'bash', 'zsh', 'dash', 'ksh', 'fish']);
const POWERSHELL_HOSTS = new Set(['pwsh', 'powershell']);
const PASSTHROUGH_PREFIXES = new Set(['command', 'builtin', 'exec', 'nohup', 'time', 'stdbuf', 'unbuffer']);
const ENV_ASSIGNMENT = /^[A-Za-z_][A-Za-z0-9_]*=/;
const BASH_DQ_ESCAPABLE = new Set(['$', '`', '"', '\\', '\n']);
const readSubstitution = (src, start) => {
    let depth = 1;
    let i = start;
    let quote = '';
    while (i < src.length) {
        const ch = src[i];
        if (quote) {
            if (ch === quote)
                quote = '';
            else if (ch === '\\' && quote === '"')
                i++;
        }
        else if (ch === "'" || ch === '"')
            quote = ch;
        else if (ch === '\\')
            i++;
        else if (ch === '(')
            depth++;
        else if (ch === ')') {
            depth--;
            if (depth === 0)
                return { body: src.slice(start, i), end: i + 1 };
        }
        i++;
    }
    return { body: src.slice(start), end: src.length };
};
/**
 * Splits a command line into simple command segments.
 * Handles quoting, escapes, operators, redirections, heredocs (bash only),
 * command substitution and comments. Substitutions become extra segments.
 */
export const parseCommandLine = (src, dialect = 'bash') => {
    const bash = dialect === 'bash';
    const backslashEscapes = bash;
    const escapeChar = dialect === 'powershell' ? '`' : '\\';
    const segments = [];
    const nested = [];
    let segment = { argv: [], redirects: [], heredocs: [] };
    let word = '';
    let inWord = false;
    let pendingRedirect = '';
    let pendingHeredocs = [];
    let i = 0;
    const endWord = () => {
        if (!inWord)
            return;
        if (pendingRedirect) {
            if (dialect !== 'powershell' && pendingRedirect.startsWith('<<') && pendingRedirect !== '<<<') {
                pendingHeredocs.push({ delimiter: word, stripTabs: pendingRedirect === '<<-', owner: segment });
            }
            segment.redirects.push({ op: pendingRedirect, target: word });
            pendingRedirect = '';
        }
        else {
            segment.argv.push(word);
        }
        word = '';
        inWord = false;
    };
    const endSegment = () => {
        endWord();
        if (segment.argv.length || segment.redirects.length)
            segments.push(segment);
        segment = { argv: [], redirects: [], heredocs: [] };
    };
    const readHeredocBodies = () => {
        for (const { delimiter, stripTabs, owner } of pendingHeredocs) {
            const lines = [];
            while (i < src.length) {
                const lineEnd = src.indexOf('\n', i);
                const stop = lineEnd === -1 ? src.length : lineEnd;
                const line = src.slice(i, stop).replace(/\r$/, '');
                i = stop + 1;
                if ((stripTabs ? line.replace(/^\t+/, '') : line) === delimiter)
                    break;
                lines.push(line);
            }
            owner.heredocs.push(lines.join('\n'));
        }
        pendingHeredocs = [];
    };
    const pushSubstitution = (body) => {
        nested.push(...parseCommandLine(body, dialect));
    };
    while (i < src.length) {
        const ch = src.charAt(i);
        const next = src[i + 1];
        if (ch === '\n') {
            endSegment();
            i++;
            if (pendingHeredocs.length)
                readHeredocBodies();
            continue;
        }
        if (ch === ' ' || ch === '\t' || ch === '\r') {
            endWord();
            i++;
            continue;
        }
        if (ch === '#' && !inWord) {
            while (i < src.length && src[i] !== '\n')
                i++;
            continue;
        }
        if (ch === escapeChar && (backslashEscapes || dialect === 'powershell')) {
            if (next === '\n' || (next === '\r' && src[i + 2] === '\n')) {
                i += next === '\r' ? 3 : 2;
                continue;
            }
            word += next ?? '';
            inWord = true;
            i += 2;
            continue;
        }
        if (ch === "'") {
            const close = src.indexOf("'", i + 1);
            const stop = close === -1 ? src.length : close;
            word += src.slice(i + 1, stop);
            inWord = true;
            i = stop + 1;
            continue;
        }
        if (ch === '"') {
            i++;
            inWord = true;
            while (i < src.length && src[i] !== '"') {
                const inner = src.charAt(i);
                if (bash && inner === '\\' && i + 1 < src.length) {
                    const escaped = src.charAt(i + 1);
                    word += BASH_DQ_ESCAPABLE.has(escaped) ? escaped : `\\${escaped}`;
                    i += 2;
                }
                else if (dialect === 'powershell' && inner === '`' && i + 1 < src.length) {
                    word += src.charAt(i + 1);
                    i += 2;
                }
                else if (inner === '$' && src[i + 1] === '(') {
                    const { body, end } = readSubstitution(src, i + 2);
                    pushSubstitution(body);
                    word += src.slice(i, end);
                    i = end;
                }
                else if (bash && inner === '`') {
                    const close = src.indexOf('`', i + 1);
                    const stop = close === -1 ? src.length : close;
                    pushSubstitution(src.slice(i + 1, stop));
                    word += src.slice(i, stop + 1);
                    i = stop + 1;
                }
                else {
                    word += inner;
                    i++;
                }
            }
            i++;
            continue;
        }
        if (ch === '$' && next === '(') {
            const { body, end } = readSubstitution(src, i + 2);
            pushSubstitution(body);
            word += src.slice(i, end);
            inWord = true;
            i = end;
            continue;
        }
        if (bash && ch === '`') {
            const close = src.indexOf('`', i + 1);
            const stop = close === -1 ? src.length : close;
            pushSubstitution(src.slice(i + 1, stop));
            word += src.slice(i, stop + 1);
            inWord = true;
            i = stop + 1;
            continue;
        }
        if (REDIRECT_START.has(ch) || (ch === '&' && next === '>')) {
            if (inWord && /^\d+$/.test(word)) {
                word = '';
                inWord = false;
            }
            else
                endWord();
            let op = ch;
            i++;
            while (i < src.length && /[<>&|-]/.test(src.charAt(i)) && op.length < 3) {
                op += src.charAt(i);
                i++;
            }
            if (op.endsWith('&') && /\d|-/.test(src.charAt(i))) {
                while (i < src.length && /[\d-]/.test(src.charAt(i)))
                    i++;
                continue;
            }
            pendingRedirect = op;
            continue;
        }
        if (ch === '&' || ch === '|' || ch === ';' || ch === '(' || ch === ')') {
            endSegment();
            i += (ch === '&' && next === '&') || (ch === '|' && (next === '|' || next === '&')) || (ch === ';' && next === ';') ? 2 : 1;
            continue;
        }
        word += ch;
        inWord = true;
        i++;
    }
    endSegment();
    if (pendingHeredocs.length)
        readHeredocBodies();
    return [...segments, ...nested];
};
/**
 * Normalizes a program name: strips directories, Windows extensions and casing.
 */
export const programName = (program) => (program.replace(/\\/g, '/').split('/').pop() ?? '').toLowerCase().replace(/\.(exe|cmd|bat|com)$/, '');
const dropWhile = (args, skip) => {
    let rest = args;
    for (let arg = rest[0]; arg !== undefined; arg = rest[0]) {
        const count = skip(arg);
        if (count === 0)
            return rest;
        rest = rest.slice(count);
    }
    return rest;
};
const skipFlags = (valued) => (arg) => {
    if (!arg.startsWith('-'))
        return 0;
    return valued?.test(arg) ? 2 : 1;
};
const skipEnvAssignments = (arg) => (ENV_ASSIGNMENT.test(arg) ? 1 : 0);
const skipEnvOptions = (arg) => (arg.startsWith('-') || ENV_ASSIGNMENT.test(arg) ? 1 : 0);
/**
 * Drops prefixes that only change how the real command runs
 * (env assignments, sudo, env, nice, timeout, xargs, rtk) so checks see the real program.
 */
export const stripPrefixes = (argv) => {
    let rest = [...argv];
    for (;;) {
        rest = dropWhile(rest, skipEnvAssignments);
        const head = rest[0];
        if (head === undefined)
            return rest;
        const name = programName(head);
        if (PASSTHROUGH_PREFIXES.has(name))
            rest = rest.slice(1);
        else if (name === 'sudo' || name === 'doas')
            rest = dropWhile(rest.slice(1), skipFlags(/^-[ugCDhpRrT]$/));
        else if (name === 'env')
            rest = dropWhile(rest.slice(1), skipEnvOptions);
        else if (name === 'nice' || name === 'ionice')
            rest = dropWhile(rest.slice(1), skipFlags(/^-[nc]$/));
        else if (name === 'timeout')
            rest = dropWhile(rest.slice(1), skipFlags()).slice(1);
        else if (name === 'xargs')
            rest = dropWhile(rest.slice(1), skipFlags(/^-[IdEnLPs]$/));
        else if (name === 'rtk') {
            rest = rest.slice(1);
            if (rest[0] === 'proxy')
                rest = rest.slice(1);
        }
        else
            return rest;
    }
};
/**
 * Expands a command line into every simple command it runs,
 * including scripts passed to `sh -c`, `eval`, `pwsh -Command` and `cmd /c`.
 */
export const expandCommands = (command, dialect = 'bash', depth = 0) => {
    const result = [];
    for (const raw of parseCommandLine(command, dialect)) {
        const argv = stripPrefixes(raw.argv);
        result.push({ ...raw, argv });
        const program = argv[0];
        if (program === undefined || depth > 4)
            continue;
        const name = programName(program);
        if (WRAPPER_SHELLS.has(name)) {
            const flagIndex = argv.findIndex((arg, idx) => idx > 0 && /^-[a-z]*c[a-z]*$/.test(arg));
            const script = argv[flagIndex + 1];
            if (flagIndex !== -1 && script !== undefined)
                result.push(...expandCommands(script, 'bash', depth + 1));
        }
        else if (name === 'eval') {
            result.push(...expandCommands(argv.slice(1).join(' '), dialect, depth + 1));
        }
        else if (POWERSHELL_HOSTS.has(name)) {
            const flagIndex = argv.findIndex((arg) => /^-(c|command)$/i.test(arg));
            if (flagIndex !== -1)
                result.push(...expandCommands(argv.slice(flagIndex + 1).join(' '), 'powershell', depth + 1));
        }
        else if (name === 'cmd') {
            const flagIndex = argv.findIndex((arg) => /^\/[ck]$/i.test(arg));
            if (flagIndex !== -1)
                result.push(...expandCommands(argv.slice(flagIndex + 1).join(' '), 'literal', depth + 1));
        }
    }
    return result;
};
const WINDOWS_PATH_HINT = /(^|[\s"'=(])([A-Za-z]:\\|\.{1,2}\\|[$%][\w:{}]+%?\\)/;
/**
 * Expands a tool command for checking. PowerShell tool input is parsed as PowerShell.
 * Bash input that contains Windows-style paths is parsed a second time with literal backslashes,
 * so `rd /s /q C:\Users` is seen as written.
 */
export const commandsForTool = (command, toolName = 'Bash') => {
    if (toolName === 'PowerShell')
        return expandCommands(command, 'powershell');
    const segments = expandCommands(command, 'bash');
    return WINDOWS_PATH_HINT.test(command) ? [...segments, ...expandCommands(command, 'literal')] : segments;
};
