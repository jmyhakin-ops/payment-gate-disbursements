import { z } from 'zod';

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

  if (err instanceof z.ZodError) {
    const issues = err.errors.map((e) => {
      const field = e.path.join('.');
      return field ? `${field}: ${e.message}` : e.message;
    }).filter(Boolean);
    const message = issues.length > 0 ? issues.join(', ') : 'Validation error';
    return Response.json(
      { success: false, message, code: 'VALIDATION_ERROR', errors: err.errors },
      { status: 400 }
    );
  }

  if (err instanceof Error) {
    if (err.message.includes('Unique constraint') || (err as any).code === 'P2002') {
      return Response.json(
        { success: false, message: 'A record with this information already exists', code: 'DUPLICATE' },
        { status: 409 }
      );
    }

    if ((err as any).code === 'P2025') {
      return Response.json(
        { success: false, message: 'Record not found', code: 'NOT_FOUND' },
        { status: 404 }
      );
    }
  }

  console.error('[API Error]', err);
  const message = err instanceof Error ? err.message : 'An internal error occurred';
  return Response.json({ success: false, message, code: 'INTERNAL_ERROR' }, { status: 500 });
}
