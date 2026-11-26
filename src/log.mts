const useColor = process.stdout.isTTY && !process.env.NO_COLOR;

type Painter = (text: string) => string;

const paint =
    (code: string): Painter =>
    (text) =>
        useColor ? `\x1b[${code}m${text}\x1b[0m` : text;

export const color = {
    dim: paint('2'),
    bold: paint('1'),
    cyan: paint('36'),
    green: paint('32'),
    yellow: paint('33'),
    red: paint('31'),
};

export const log = {
    info: (message: string): void => console.log(`${color.cyan('i')} ${message}`),
    success: (message: string): void => console.log(`${color.green('+')} ${message}`),
    warn: (message: string): void => console.log(`${color.yellow('!')} ${message}`),
    error: (message: string): void => console.error(`${color.red('x')} ${message}`),
    step: (message: string): void => console.log(`\n${color.bold(color.cyan(message))}`),
    plain: (message: string): void => console.log(message),
};

/** Extracts a printable message from a thrown value. */
export const errorMessage = (error: unknown): string => (error instanceof Error ? error.message : String(error));
