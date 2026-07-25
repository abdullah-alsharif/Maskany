import { describe, expect, it } from 'vitest';
import { extractAndParseJSON } from '../../src/lib/extract-json.js';

describe('extractAndParseJSON', () => {
  it('[T023] extracts and parses a simple JSON object', () => {
    const result = extractAndParseJSON('Some text\n{"key": "value"}\nmore text');
    expect(result).toEqual({ key: 'value' });
  });

  it('[T023] handles nested braces inside string values', () => {
    const result = extractAndParseJSON('{"text": "Hello {world} how {are} you"}');
    expect(result).toEqual({ text: 'Hello {world} how {are} you' });
  });

  it('[T023] strips markdown code fences before parsing', () => {
    const result = extractAndParseJSON('```json\n{"key": "value"}\n```');
    expect(result).toEqual({ key: 'value' });
  });

  it('[T023] returns null for non-JSON responses', () => {
    expect(() => extractAndParseJSON('Just some plain text')).toThrow();
  });

  it('[T023] handles JSON array responses', () => {
    const result = extractAndParseJSON('[{"id": 1}, {"id": 2}]');
    expect(result).toEqual([{ id: 1 }, { id: 2 }]);
  });
});
