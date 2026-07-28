import { ErrorCode, HttpError } from './http-error.js';

export interface CursorPayload {
  v: string;
  i: string;
}

export function encodeCursor(sortValue: string, id: string): string {
  const payload: CursorPayload = { v: sortValue, i: id };
  return Buffer.from(JSON.stringify(payload), 'utf8').toString('base64url');
}

export function decodeCursor(encoded: string): CursorPayload {
  let decoded: unknown;
  try {
    const json = Buffer.from(encoded, 'base64url').toString('utf8');
    decoded = JSON.parse(json);
  } catch {
    throw new HttpError(400, ErrorCode.VALIDATION_ERROR, 'Cursor is malformed.');
  }
  if (
    typeof decoded !== 'object' ||
    decoded === null ||
    typeof (decoded as Partial<CursorPayload>).v !== 'string' ||
    typeof (decoded as Partial<CursorPayload>).i !== 'string'
  ) {
    throw new HttpError(400, ErrorCode.VALIDATION_ERROR, 'Cursor payload is invalid.');
  }
  return decoded as CursorPayload;
}

export function getSortColumn(
  sort: 'newest' | 'price_asc' | 'price_desc' | 'rating_desc',
): 'created_at' | 'price' | 'average_rating' {
  const map: Record<string, 'created_at' | 'price' | 'average_rating'> = {
    newest: 'created_at',
    price_asc: 'price',
    price_desc: 'price',
    rating_desc: 'average_rating',
  };
  return map[sort];
}

export function getSortDirection(
  sort: 'newest' | 'price_asc' | 'price_desc' | 'rating_desc',
): 'asc' | 'desc' {
  const map: Record<string, 'asc' | 'desc'> = {
    newest: 'desc',
    price_asc: 'asc',
    price_desc: 'desc',
    rating_desc: 'desc',
  };
  return map[sort];
}
