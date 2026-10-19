import 'dotenv/config';
import { Logger, ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import helmet from 'helmet';
import { AppModule } from './app.module';
import type { AdminConfig } from './config';

/**
 * POS-ADMIN API: the Golden Bites team's sign-in and the bridge to the POS's
 * internal API. Served under /admin-api/v1 (the Admin app proxies it).
 */
async function bootstrap(): Promise<void> {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  const config = app.get(ConfigService).getOrThrow<AdminConfig>('admin');

  app.set('trust proxy', 1);
  app.use(helmet());
  app.enableCors({
    origin: config.corsOrigin.split(','),
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  });
  app.setGlobalPrefix('admin-api/v1');
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));

  await app.listen(config.port);
  Logger.log(`POS-ADMIN API on http://localhost:${config.port}/admin-api/v1 → POS ${config.posInternalUrl}`, 'Bootstrap');
}

void bootstrap();
