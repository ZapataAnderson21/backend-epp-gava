import { NestFactory, Reflector } from '@nestjs/core';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { AppModule } from './app.module';
import { Logger, ValidationPipe } from '@nestjs/common';
import * as express from 'express';
import { join } from 'path';

async function bootstrap() {
  const app = await NestFactory.create(AppModule,{
    logger: ['error', 'warn', 'log', 'debug', 'verbose'],
  });

  const reflector = app.get(Reflector);

  app.enableCors({
    origin: ['http://localhost:5173', 'http://sir.gavacyc.com', 'https://sir.gavacyc.com'],
    credentials: true,
  });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  app.use('/uploads', express.static(join(__dirname, '..', 'uploads')));

  const config = new DocumentBuilder()
    .setTitle('GAVA C&C Requirements Request System')
    .setDescription('API documentation for the GAVA C&C Requirements Request System')
    .setVersion('1.0')
    .build();
  
  const documentFactory = () => SwaggerModule.createDocument(app, config);

  SwaggerModule.setup('documentation', app, documentFactory);

  const logger = new Logger('Main');

  await app.listen(process.env.PORT ?? 3001);

  logger.log(`Application is running on: ${process.env.PORT ?? 3001}`);
}
bootstrap();
