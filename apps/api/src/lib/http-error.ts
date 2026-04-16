/**
 * Application-level HTTP error carrying an explicit status, a stable error
 * `code` for the API response envelope, and a human-readable `message`.
 *
 * Instances are intentionally serialisable by the error handler in a way that
 * preserves `status` + `code` without leaking stack traces to the client.
 */
export class HttpError extends Error {
  public readonly status: number;
  public readonly code: string;

  constructor(status: number, code: string, message: string) {
    super(message);
    this.name = 'HttpError';
    this.status = status;
    this.code = code;
  }
}

export const ErrorCode = {
  UNAUTHORIZED: 'UNAUTHORIZED',
  FORBIDDEN: 'FORBIDDEN',
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  NOT_FOUND: 'NOT_FOUND',
  INTERNAL_ERROR: 'INTERNAL_ERROR',
  RATE_LIMITED: 'RATE_LIMITED',
  PAYLOAD_TOO_LARGE: 'PAYLOAD_TOO_LARGE',
  PHONE_ALREADY_REGISTERED: 'PHONE_ALREADY_REGISTERED',
  EMAIL_ALREADY_REGISTERED: 'EMAIL_ALREADY_REGISTERED',
  USER_NOT_FOUND: 'USER_NOT_FOUND',
  PROPERTY_NOT_FOUND: 'PROPERTY_NOT_FOUND',
  REVIEW_NOT_FOUND: 'REVIEW_NOT_FOUND',
  REVIEW_ALREADY_EXISTS: 'REVIEW_ALREADY_EXISTS',
  MEDIA_NOT_FOUND: 'MEDIA_NOT_FOUND',
  OTP_RATE_LIMIT: 'OTP_RATE_LIMIT',
  OTP_EXPIRED: 'OTP_EXPIRED',
  OTP_INVALID: 'OTP_INVALID',
  NO_FILES_PROVIDED: 'NO_FILES_PROVIDED',
  INVALID_MIME_TYPE: 'INVALID_MIME_TYPE',
  FILE_TOO_LARGE: 'FILE_TOO_LARGE',
  TOO_MANY_IMAGES: 'TOO_MANY_IMAGES',
  TOO_MANY_VIDEOS: 'TOO_MANY_VIDEOS',
  MEDIA_IDS_MISMATCH: 'MEDIA_IDS_MISMATCH',
} as const;
