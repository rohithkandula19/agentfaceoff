/**
 * Strip markdown formatting from LLM output so it renders as plain readable text.
 * Removes: bold, italic, headers, code fences, inline code,
 *          em-dashes, en-dashes, horizontal rules.
 */
export function cleanText(raw: string): string {
  return raw
    // ── code fences — keep content, drop fences
    .replace(/```[\w]*\n?([\s\S]*?)```/g, '$1')
    // ── bold: ***text*** / **text** / __text__
    .replace(/\*{3}(.+?)\*{3}/g, '$1')
    .replace(/\*{2}(.+?)\*{2}/g, '$1')
    .replace(/__(.+?)__/g, '$1')
    // ── italic: *text* / _text_ (not inside words)
    .replace(/(?<!\w)\*(.+?)\*(?!\w)/g, '$1')
    .replace(/(?<!\w)_(.+?)_(?!\w)/g, '$1')
    // ── headers: #, ##, ###
    .replace(/^#{1,6}\s+/gm, '')
    // ── em dash (U+2014) and en dash (U+2013) — use unicode escapes to avoid encoding issues
    .replace(/\s*—\s*/g, ' - ')
    .replace(/\s*–\s*/g, ' - ')
    // ── double-hyphen used as em dash (but not in URLs — skip if preceded by colon)
    .replace(/(?<!:)\s+--\s+/g, ' - ')
    // ── inline code: `code`
    .replace(/`([^`]+)`/g, '$1')
    // ── horizontal rules
    .replace(/^[-*]{3,}\s*$/gm, '')
    // ── collapse 3+ blank lines to 2
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}
