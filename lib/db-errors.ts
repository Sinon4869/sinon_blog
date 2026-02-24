export type AppErrorCode = 'DB_UNAVAILABLE' | 'DB_CONFLICT' | 'DB_QUERY_FAILED' | 'AUTH_FORBIDDEN' | 'VALIDATION_FAILED';

export class AppError extends Error {
  code: AppErrorCode;
  status: number;

  constructor(code: AppErrorCode, message: string, status = 500) {
    super(message);
    this.code = code;
    this.status = status;
  }
}

export function mapDbError(error: unknown): AppError {
  const msg = error instanceof Error ? error.message : String(error || 'unknown db error');
  const lower = msg.toLowerCase();
  if (lower.includes('unique') || lower.includes('constraint')) {
    return new AppError('DB_CONFLICT', msg, 409);
  }
  return new AppError('DB_QUERY_FAILED', msg, 500);
}
