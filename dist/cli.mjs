#!/usr/bin/env node
import { parseArgs, USAGE } from './args.mjs';
import { doctor } from './doctor.mjs';
import { install } from './install.mjs';
import { color, errorMessage, log } from './log.mjs';
import { resolveTarget, userConfigDir } from './paths.mjs';
import { isInteractive, selectOne } from './prompt.mjs';
import { uninstall } from './uninstall.mjs';
const chooseScope = async (options) => {
    if (options.scope)
        return options.scope;
    if (options.command === 'doctor' || options.yes || !isInteractive())
        return 'global';
    return selectOne('Where should the stack go?', [
        { label: `Global (${userConfigDir()}, every project)`, value: 'global' },
        { label: `Project (${options.projectDir})`, value: 'project' },
    ]);
};
const main = async () => {
    const options = parseArgs(process.argv.slice(2), process.cwd());
    if (options.command === 'help') {
        log.plain(USAGE);
        return 0;
    }
    if (!options.yes && !options.dryRun && options.command !== 'doctor' && !isInteractive()) {
        throw new Error('No TTY available: pass --yes to run non-interactively, or --dry-run to preview.');
    }
    log.plain(color.bold('claude-code-stack'));
    const target = resolveTarget(await chooseScope(options), options.projectDir);
    if (options.command === 'doctor')
        return doctor(target);
    if (options.command === 'uninstall')
        await uninstall(target, options);
    else
        await install(target, options);
    return 0;
};
main().then((code) => process.exit(code), (error) => {
    log.error(errorMessage(error));
    process.exit(1);
});
