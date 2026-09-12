const jwtSecret = process.env.JWT_SECRET?.trim();

if (
  process.env.NODE_ENV === 'production' &&
  (!jwtSecret || Buffer.byteLength(jwtSecret, 'utf8') < 32)
) {
  throw new Error(
    'JWT_SECRET must be configured with at least 32 bytes in production',
  );
}

export const jwtConstants = {
  secret: jwtSecret || 'dev-only-jwt-secret-change-me',
};
