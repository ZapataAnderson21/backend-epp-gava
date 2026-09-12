import { NestFactory } from '@nestjs/core';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { AppModule } from './app.module';
import { Logger, ValidationPipe } from '@nestjs/common';
import helmet from 'helmet';
import type { NextFunction, Request, Response } from 'express';
import { ACCESS_TOKEN_COOKIE } from './user/jwt/access-token';

async function bootstrap() {
  const isProduction = process.env.NODE_ENV === 'production';
  const app = await NestFactory.create(AppModule, {
    logger: isProduction
      ? ['error', 'warn']
      : ['error', 'warn', 'log', 'debug', 'verbose'],
  });

  const defaultCorsOrigins = isProduction
    ? ['https://sir.gavacyc.com']
    : ['http://localhost:5173', 'https://sir.gavacyc.com'];

  const corsOrigins = (process.env.CORS_ORIGINS || defaultCorsOrigins.join(','))
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);

  app.enableCors({
    origin: corsOrigins,
    credentials: true,
  });

  const expressApp = app.getHttpAdapter().getInstance() as {
    set: (setting: string, value: unknown) => void;
    get: (
      path: string,
      handler: (_request: Request, response: Response) => void,
    ) => void;
  };
  expressApp.set('trust proxy', 'loopback');

  app.use(helmet());
  app.use((request: Request, response: Response, next: NextFunction) => {
    const isUnsafeMethod = !['GET', 'HEAD', 'OPTIONS'].includes(request.method);
    const usesSessionCookie = request.headers.cookie
      ?.split(';')
      .some((cookie) => cookie.trim().startsWith(`${ACCESS_TOKEN_COOKIE}=`));
    const usesBearer = request.headers.authorization?.startsWith('Bearer ');
    if (isUnsafeMethod && usesSessionCookie && !usesBearer) {
      const origin = request.headers.origin;
      if (!origin || !corsOrigins.includes(origin)) {
        response.status(403).json({
          statusCode: 403,
          message: 'Origen de solicitud no permitido.',
        });
        return;
      }
    }
    next();
  });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  if (!isProduction || process.env.ENABLE_SWAGGER === 'true') {
    const config = new DocumentBuilder()
      .setTitle('GAVA C&C Requirements Request System')
      .setDescription(
        'API documentation for the GAVA C&C Requirements Request System',
      )
      .setVersion('1.0')
      .build();
    const documentFactory = () => SwaggerModule.createDocument(app, config);
    SwaggerModule.setup('documentation', app, documentFactory);
  } else {
    // Conserva la URL usada por el health-check del despliegue sin exponer Swagger.
    expressApp.get('/documentation', (_request, response) => {
      response.status(204).end();
    });
  }

  const logger = new Logger('Main');

  await app.listen(process.env.PORT ?? 3001);

  logger.log(`Application is running on: ${process.env.PORT ?? 3001}`);
}
void bootstrap();
