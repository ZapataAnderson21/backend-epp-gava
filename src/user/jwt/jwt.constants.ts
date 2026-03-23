const jwtSecret = process.env.JWT_SECRET?.trim();

if (process.env.NODE_ENV === 'production' && !jwtSecret) {
  throw new Error('JWT_SECRET environment variable is required in production');
}

export const jwtConstants = {
  secret: jwtSecret || 'dev-only-jwt-secret-change-me',
};
