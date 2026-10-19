export class AppError extends Error {
  public statusCode: number;
  public code: string;

  constructor(message: string, statusCode = 500, code = 'INTERNAL_ERROR') {
    super(message);
    this.name = 'AppError';
    this.statusCode = statusCode;
    this.code = code;
  }
}

export function handleApiError(err: unknown): Response {
  if (err instanceof AppError) {
    return Response.json(
      { success: false, message: err.message, code: err.code },
      { status: err.statusCode }
    );
  }
  if (err instanceof Error && err.message.includes('Unique constraint')) {
    return Response.json({ success: false, message: 'Record already exists', code: 'DUPLICATE' }, { status: 409 });
  }
  console.error('[API Error]', err);
  return Response.json({ success: false, message: 'An internal error occurred', code: 'INTERNAL_ERROR' }, { status: 500 });
}
