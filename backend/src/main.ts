import './prisma/disable-data-proxy-env';
import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { NextFunction, Request, Response, json, urlencoded } from 'express';
import { existsSync } from 'fs';
import { join } from 'path';
import { AppModule } from './app.module';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  const config = app.get(ConfigService);
  const frontendDistPath = join(__dirname, '..', '..', 'frontend', 'dist');
  const bodyLimit = config.get<string>('BODY_LIMIT') || '10mb';
  const configuredOrigins = (config.get<string>('FRONTEND_URL') || '')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);
  const allowedOrigins = configuredOrigins.length
    ? configuredOrigins
    : process.env.NODE_ENV === 'production'
      ? []
      : ['http://localhost:5173'];

  app.setGlobalPrefix('api');
  app.use((_request: Request, response: Response, next: NextFunction) => {
    response.setHeader('X-Content-Type-Options', 'nosniff');
    response.setHeader('X-Frame-Options', 'SAMEORIGIN');
    response.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    response.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
    next();
  });
  app.use(json({ limit: bodyLimit }));
  app.use(urlencoded({ extended: true, limit: bodyLimit }));
  app.enableCors({
    origin: (origin, callback) => {
      if (!origin || allowedOrigins.includes(origin)) {
        callback(null, true);
        return;
      }
      callback(new Error('Not allowed by CORS'));
    },
    credentials: true
  });
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true
    })
  );
  app.useGlobalFilters(new HttpExceptionFilter());

  if (existsSync(frontendDistPath)) {
    app.useStaticAssets(frontendDistPath);
    app.getHttpAdapter().getInstance().get(/^\/(?!api).*/, (_request, response) => {
      response.sendFile(join(frontendDistPath, 'index.html'));
    });
  }

  await app.listen(config.get<number>('PORT') || 5000);
}

bootstrap();
