function parseBalanced(text: string, openChar: string, closeChar: string): unknown {
  let depth = 0;
  let inString = false;

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inString) {
      if (ch === '\\') {
        i++;
        continue;
      }
      if (ch === '"') inString = false;
      continue;
    }
    if (ch === '"') {
      inString = true;
      continue;
    }
    if (ch === openChar) {
      depth++;
      continue;
    }
    if (ch === closeChar) {
      depth--;
      if (depth === 0) {
        return JSON.parse(text.slice(0, i + 1));
      }
    }
  }

  throw new Error(`Unbalanced ${openChar}${closeChar} in response`);
}

export function extractAndParseJSON(text: string): unknown {
  let cleaned = text
    .replace(/```json\n?/gi, '')
    .replace(/```\n?/g, '')
    .trim();

  const arrayMatch = cleaned.match(/^\[/);
  const objectMatch = cleaned.match(/^\{/);

  if (!arrayMatch && !objectMatch) {
    const firstBrace = cleaned.indexOf('{');
    const firstBracket = cleaned.indexOf('[');
    const startIdx =
      firstBrace === -1
        ? firstBracket
        : firstBracket === -1
          ? firstBrace
          : Math.min(firstBrace, firstBracket);
    if (startIdx === -1) throw new Error('No JSON structure found');
    cleaned = cleaned.slice(startIdx);
  }

  if (cleaned.startsWith('[')) {
    return parseBalanced(cleaned, '[', ']');
  }
  return parseBalanced(cleaned, '{', '}');
}
