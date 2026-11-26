import readline from 'node:readline';
import type { Key } from 'node:readline';
import { color } from './log.mts';

export interface Choice<T> {
    label: string;
    value: T;
    checked?: boolean;
}

/** Tells whether both stdin and stdout are terminals. */
export const isInteractive = (): boolean => Boolean(process.stdin.isTTY && process.stdout.isTTY);

const menu = <T,>(message: string, choices: Choice<T>[], multi: boolean): Promise<T[]> =>
    new Promise((resolve) => {
        let cursor = 0;
        const selected = new Set(choices.flatMap((choice, index) => (choice.checked ? [index] : [])));
        const hint = multi ? 'space: toggle, a: all, enter: confirm' : 'arrows: move, enter: select';
        const lines = choices.length + 1;
        const draw = (redraw: boolean): void => {
            if (redraw) process.stdout.write(`\x1b[${lines}A\x1b[0J`);
            process.stdout.write(`${color.cyan('?')} ${color.bold(message)} ${color.dim(`(${hint})`)}\n`);
            choices.forEach((choice, index) => {
                const pointer = index === cursor ? color.cyan('>') : ' ';
                const box = multi ? (selected.has(index) ? color.green('[x]') : color.dim('[ ]')) : '';
                process.stdout.write(`  ${pointer} ${box} ${index === cursor ? color.cyan(choice.label) : choice.label}\n`);
            });
        };
        const finish = (): void => {
            process.stdin.off('keypress', onKey);
            process.stdin.setRawMode(false);
            process.stdin.pause();
            process.stdout.write('\x1b[?25h');
            process.stdout.write(`\x1b[${lines}A\x1b[0J`);
            const current = choices[cursor];
            const picked = multi ? choices.filter((_, index) => selected.has(index)) : current ? [current] : [];
            process.stdout.write(`${color.green('+')} ${message} ${color.dim(picked.map((choice) => choice.label).join(', ') || 'none')}\n`);
            resolve(picked.map((choice) => choice.value));
        };
        const onKey = (_input: string | undefined, key: Key = {}): void => {
            if (key.ctrl && key.name === 'c') {
                process.stdout.write('\x1b[?25h\n');
                process.exit(130);
            }
            if (key.name === 'up') cursor = (cursor - 1 + choices.length) % choices.length;
            else if (key.name === 'down') cursor = (cursor + 1) % choices.length;
            else if (multi && key.name === 'space') {
                if (selected.has(cursor)) selected.delete(cursor);
                else selected.add(cursor);
            } else if (multi && key.name === 'a') {
                if (selected.size === choices.length) selected.clear();
                else choices.forEach((_, index) => selected.add(index));
            } else if (key.name === 'return') return finish();
            draw(true);
        };
        readline.emitKeypressEvents(process.stdin);
        process.stdin.setRawMode(true);
        process.stdin.resume();
        process.stdout.write('\x1b[?25l');
        process.stdin.on('keypress', onKey);
        draw(false);
    });

/** Asks for one choice with an arrow-key menu. */
export const selectOne = async <T,>(message: string, choices: Choice<T>[]): Promise<T> => {
    const [value] = await menu(message, choices, false);
    if (value === undefined) throw new Error(`${message}: no choice available`);
    return value;
};

/** Asks for any number of choices with an arrow-key menu. Resolves immediately when there is nothing to choose. */
export const selectMany = async <T,>(message: string, choices: Choice<T>[]): Promise<T[]> => (choices.length ? menu(message, choices, true) : []);

/** Asks a yes/no question, with `fallback` as the highlighted answer. */
export const confirm = async (message: string, fallback: boolean = true): Promise<boolean> =>
    selectOne(message, [
        { label: fallback ? 'Yes' : 'No', value: fallback },
        { label: fallback ? 'No' : 'Yes', value: !fallback },
    ]);
