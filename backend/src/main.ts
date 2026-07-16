import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { json, urlencoded } from 'express';
import { existsSync } from 'fs';
import { join } from 'path';
import { AppModule } from './app.module';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  const config = app.get(ConfigService);
  const frontendDistPath = join(__dirname, '..', '..', 'frontend', 'dist');
  const bodyLimit = config.get<string>('BODY_LIMIT') || '10mb';

  app.setGlobalPrefix('api');
  app.use(json({ limit: bodyLimit }));
  app.use(urlencoded({ extended: true, limit: bodyLimit }));
  app.enableCors({
    origin: config.get<string>('FRONTEND_URL') || 'http://localhost:5173',
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
