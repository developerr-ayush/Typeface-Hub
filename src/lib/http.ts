import { NextResponse } from 'next/server';
import { ZodError } from 'zod';

export class HttpError extends Error {
  constructor(
    public status: number,
    message: string,
    public details?: unknown,
  ) {
    super(message);
  }
}

export const badRequest = (message: string, details?: unknown) => new HttpError(400, message, details);
export const notFound = (message = 'Not found') => new HttpError(404, message);
export const forbidden = (message = 'You do not have permission to do this.') => new HttpError(403, message);
export const conflict = (message: string, details?: unknown) => new HttpError(409, message, details);

export function json(data: unknown, init?: ResponseInit) {
  return NextResponse.json(data, init);
}

export function errorResponse(err: unknown) {
  if (err instanceof HttpError) {
    return NextResponse.json({ error: { message: err.message, details: err.details } }, { status: err.status });
  }
  if (err instanceof ZodError) {
    const first = err.issues[0];
    return NextResponse.json(
      {
        error: {
          message: first ? `${first.path.join('.') || 'input'}: ${first.message}` : 'Invalid input',
          details: err.issues,
        },
      },
      { status: 400 },
    );
  }
  console.error(err);
  return NextResponse.json({ error: { message: 'Something went wrong on our side. Please try again.' } }, { status: 500 });
}

type Handler<C> = (req: Request, ctx: C) => Promise<Response>;
export function handler<C>(fn: Handler<C>): Handler<C> {
  return async (req, ctx) => {
    try {
      return await fn(req, ctx);
    } catch (err) {
      return errorResponse(err);
    }
  };
}

export async function readJson<T = unknown>(req: Request): Promise<T> {
  try {
    return (await req.json()) as T;
  } catch {
    throw badRequest('Request body must be valid JSON.');
  }
}
