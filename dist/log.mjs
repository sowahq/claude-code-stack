const useColor = process.stdout.isTTY && !process.env.NO_COLOR;
const paint = (code) => (text) => useColor ? `\x1b[${code}m${text}\x1b[0m` : text;
export const color = {
    dim: paint('2'),
    bold: paint('1'),
    cyan: paint('36'),
    green: paint('32'),
    yellow: paint('33'),
    red: paint('31'),
};
export const log = {
    info: (message) => console.log(`${color.cyan('i')} ${message}`),
    success: (message) => console.log(`${color.green('+')} ${message}`),
    warn: (message) => console.log(`${color.yellow('!')} ${message}`),
    error: (message) => console.error(`${color.red('x')} ${message}`),
    step: (message) => console.log(`\n${color.bold(color.cyan(message))}`),
    plain: (message) => console.log(message),
};
/** Extracts a printable message from a thrown value. */
export const errorMessage = (error) => (error instanceof Error ? error.message : String(error));
