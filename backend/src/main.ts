import './prisma/disable-data-proxy-env';
import { ValidationPipe } from '@nestjs/common';
import { CorsOptionsDelegate } from '@nestjs/common/interfaces/external/cors-options.interface';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { NextFunction, Request, Response, json, urlencoded } from 'express';
import { existsSync } from 'fs';
import { join } from 'path';
import { AppModule } from './app.module';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';
import { isOwnOrigin } from './common/security/same-origin';

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

  // Behind NGINX/Cloudflare set TRUST_PROXY (for example "loopback" or "1") so the real client address is used
  // for sign-in throttling. Leave it unset when the API is reached directly.
  const trustProxy = config.get<string>('TRUST_PROXY');
  if (trustProxy) app.set('trust proxy', /^\d+$/.test(trustProxy) ? Number(trustProxy) : trustProxy);

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
  // Allowed: requests without an Origin, origins listed in FRONTEND_URL, and the site's own origin. The last case
  // matters when this server also serves frontend/dist: Vite marks the bundle's script/style tags as crossorigin,
  // so the browser sends the page's own Origin even for same-site assets and API calls. A browser always sends the
  // Host of the server it contacts, so a page on another site still fails this check. Other origins are refused.
  const corsDelegate: CorsOptionsDelegate<Request> = (request, callback) => {
    const origin = request.header('origin');
    if (!origin || allowedOrigins.includes(origin) || isOwnOrigin(origin, request.header('host'))) {
      callback(null, { origin: true, credentials: true });
      return;
    }
    callback(new Error('Not allowed by CORS'), { origin: false });
  };
  app.enableCors(corsDelegate);
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
