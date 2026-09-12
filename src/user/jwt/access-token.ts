import type { Request } from 'express';

export const ACCESS_TOKEN_COOKIE = 'sir_gava_session';

export interface SessionJwtPayload {
  userId: number;
  email: string;
  authVersion: number;
  exp?: number;
  iat?: number;
}

function cookieValue(cookieHeader: string | undefined, name: string) {
  if (!cookieHeader) return undefined;

  for (const part of cookieHeader.split(';')) {
    const separator = part.indexOf('=');
    if (separator < 0) continue;
    if (part.slice(0, separator).trim() !== name) continue;
    return part.slice(separator + 1).trim();
  }

  return undefined;
}

export function extractAccessToken(request: Pick<Request, 'headers'>) {
  const authorization = request.headers.authorization;
  if (authorization?.startsWith('Bearer ')) {
    return authorization.slice('Bearer '.length).trim();
  }

  return cookieValue(request.headers.cookie, ACCESS_TOKEN_COOKIE);
}

export function extractAccessTokenFromCookie(cookieHeader?: string) {
  return cookieValue(cookieHeader, ACCESS_TOKEN_COOKIE);
}
