import 'reflect-metadata';
import { config as loadEnv } from 'dotenv';
import path from 'node:path';
import cookieParser from 'cookie-parser';

loadEnv({ path: path.resolve(__dirname, '../../../.env') });

import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';

import { AppModule } from './app.module';
import { GlobalExceptionFilter } from './common/filters/global-exception.filter';
import { RequestLoggingInterceptor } from './common/logging/request-logging.interceptor';
import { AppConfigService } from './config/app-config.service';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    bufferLogs: true,
  });

  const config = app.get(AppConfigService);
  const logger = new Logger('Bootstrap');

  app.use(cookieParser(config.cookieSecret));
  app.useGlobalFilters(new GlobalExceptionFilter(config));
  app.useGlobalInterceptors(new RequestLoggingInterceptor());

  app.enableCors({
    origin: config.corsAllowedOrigins,
    credentials: true,
  });

  const swaggerConfig = new DocumentBuilder()
    .setTitle('Gym Companion API')
    .setDescription(
      'API Phase 0–1.4 — authentification, profil, health, références, catalogue d’exercices et préférences/favoris',
    )
    .setVersion('0.1.0')
    .addBearerAuth()
    .build();
  const document = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup('docs', app, document);

  await app.listen(config.port);
  logger.log(`API listening on port ${config.port}`);
}

bootstrap().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : 'Unknown bootstrap error';
  console.error(message);
  process.exit(1);
});
