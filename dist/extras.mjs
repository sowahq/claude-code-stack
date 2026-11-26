import { run, which } from './exec.mjs';
import { log } from './log.mjs';
export const EXTRAS = [
    {
        id: 'rtk',
        label: 'rtk: rewrites shell commands to save tokens (needs cargo)',
        installed: () => which('rtk') !== null,
        unavailable: () => (which('cargo') ? null : 'cargo not found'),
        install: () => run('cargo', ['install', '--git', 'https://github.com/rtk-ai/rtk'], { inherit: true }).ok && run('rtk', ['init', '-g'], { inherit: true }).ok,
    },
];
/** Lists the optional tools that are missing and installable here. */
export const missingExtras = () => EXTRAS.filter((extra) => !extra.installed() && extra.unavailable() === null);
/** Installs optional tools, reporting each result. */
export const installExtras = (extras) => {
    for (const extra of extras) {
        log.info(`Installing ${extra.id}...`);
        if (extra.install())
            log.success(`${extra.id} installed`);
        else
            log.error(`${extra.id} failed to install`);
    }
};
