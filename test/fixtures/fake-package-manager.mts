import fs from 'node:fs';
import path from 'node:path';

const args = process.argv.slice(2);
const log = process.env.FAKE_PM_LOG;
const bin = process.env.FAKE_PM_BIN;
if (log) fs.appendFileSync(log, `${JSON.stringify(args)}\n`);
if (bin && args.includes('typescript@7')) {
    const tsc = 'console.log("Version 7.0.2");';
    if (process.platform === 'win32') fs.writeFileSync(path.join(bin, 'tsc.cmd'), `@"${process.execPath}" -e "${tsc.replace(/"/g, '\\"')}"\r\n`);
    else fs.writeFileSync(path.join(bin, 'tsc'), `#!/bin/sh\nexec "${process.execPath}" -e '${tsc}'\n`, { mode: 0o755 });
}
