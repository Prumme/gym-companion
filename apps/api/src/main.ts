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

/**
 * Swagger :
 * - SWAGGER_ENABLED=true|false force le comportement ;
 * - sinon : désactivé uniquement quand GYM_ENV=production (compose prod).
 * Staging compose force NODE_ENV=production mais n’a pas GYM_ENV=production,
 * donc /docs reste disponible en staging.
 */
function resolveSwaggerEnabled(): boolean {
  if (process.env.SWAGGER_ENABLED === 'true') return true;
  if (process.env.SWAGGER_ENABLED === 'false') return false;
  return process.env.GYM_ENV !== 'production';
}

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    bufferLogs: true,
  });

  const config = app.get(AppConfigService);
  const logger = new Logger('Bootstrap');

  // Derrière Caddy (1 hop) : X-Forwarded-* pour rate-limit IP / proto HTTPS.
  if (config.isProduction) {
    const httpAdapter = app.getHttpAdapter().getInstance() as {
      set?: (key: string, value: unknown) => void;
    };
    httpAdapter.set?.('trust proxy', 1);
  }

  app.use(cookieParser(config.cookieSecret));
  app.useGlobalFilters(new GlobalExceptionFilter(config));
  app.useGlobalInterceptors(new RequestLoggingInterceptor());

  app.enableCors({
    origin: config.corsAllowedOrigins,
    credentials: true,
  });

  if (resolveSwaggerEnabled()) {
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
  } else {
    logger.log('Swagger disabled');
  }

  await app.listen(config.port);
  logger.log(`API listening on port ${config.port}`);
}

bootstrap().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : 'Unknown bootstrap error';
  console.error(message);
  process.exit(1);
});
