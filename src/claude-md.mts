export const BLOCK_BEGIN = '<!-- BEGIN claude-code-stack (managed, do not edit) -->';
export const BLOCK_END = '<!-- END claude-code-stack -->';

const escape = (value: string): string => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const BLOCK = new RegExp(`\\n?${escape(BLOCK_BEGIN)}\\r?\\n@[^\\r\\n]+\\r?\\n${escape(BLOCK_END)}\\r?\\n?`);

const count = (content: string, marker: string): number => content.split(marker).length - 1;

/**
 * Ensures the managed block is intact: one BEGIN, one END, a single import line between them.
 * Edits are refused otherwise, so user text next to a broken block is never deleted.
 * Returns true when the block is present.
 */
const assertIntact = (content: string): boolean => {
    const begins = count(content, BLOCK_BEGIN);
    const ends = count(content, BLOCK_END);
    if (begins === 0 && ends === 0) return false;
    if (begins === 1 && ends === 1 && BLOCK.test(content)) return true;
    throw new Error(`CLAUDE.md has a damaged claude-code-stack block (${begins} BEGIN, ${ends} END marker). Fix or remove it by hand, then re-run.`);
};

const block = (importPath: string): string => `${BLOCK_BEGIN}\n@${importPath}\n${BLOCK_END}\n`;

/** Returns CLAUDE.md content with the managed import block present exactly once. Throws when the existing block is damaged. */
export const withImport = (content: string | null, importPath: string): string => {
    if (content === null || !content.trim()) return block(importPath);
    if (assertIntact(content)) return content.replace(BLOCK, (match) => `${match.startsWith('\n') ? '\n' : ''}${block(importPath)}`);
    return `${content.replace(/\s*$/, '')}\n\n${block(importPath)}`;
};

/** Returns CLAUDE.md content without the managed block, or null when nothing else remains. Throws when the block is damaged. */
export const withoutImport = (content: string): string | null => {
    if (!assertIntact(content)) return content;
    const stripped = content.replace(BLOCK, '\n').replace(/\n{3,}/g, '\n\n');
    return stripped.trim() ? `${stripped.trim()}\n` : null;
};

/** Tells whether CLAUDE.md content carries the managed block. */
export const hasImport = (content: string | null): boolean => content !== null && content.includes(BLOCK_BEGIN);
