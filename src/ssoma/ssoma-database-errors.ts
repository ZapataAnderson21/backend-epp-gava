import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';

interface PrismaKnownRequestErrorLike {
  code: string;
  meta?: { target?: string | string[] };
}

function isPrismaKnownRequestError(
  error: unknown,
): error is PrismaKnownRequestErrorLike {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    typeof error.code === 'string' &&
    /^P\d{4}$/.test(error.code)
  );
}

export function mapSsomaDatabaseError(error: unknown): Error | null {
  if (!isPrismaKnownRequestError(error)) return null;
  switch (error.code) {
    case 'P2002':
      return new ConflictException({
        message: 'A conflicting SSOMA record already exists.',
        constraint: error.meta?.target ?? undefined,
      });
    case 'P2025':
      return new NotFoundException('The requested SSOMA record was not found.');
    case 'P2003':
      return new BadRequestException('The SSOMA record references invalid data.');
    default:
      return null;
  }
}

export function throwSsomaDatabaseError(error: unknown): never {
  const mapped = mapSsomaDatabaseError(error);
  if (mapped) throw mapped;
  throw error;
}
