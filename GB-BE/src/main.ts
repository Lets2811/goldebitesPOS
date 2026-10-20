import { Logger, ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import compression from 'compression';
import helmet from 'helmet';
import { AppModule } from './app.module';
import { AppConfig } from './config/app.config';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    bufferLogs: true,
  });

  const configService = app.get(ConfigService);
  const appConfig = configService.getOrThrow<AppConfig>('app');

  app.set('trust proxy', 1);
  // JSON bodies up to 300 KB (Express's default is 100 KB): room for an
  // "Arma tu combo" template (up to 200 KB) inside its request.
  app.useBodyParser('json', { limit: '300kb' });
  app.use(helmet());
  app.use(compression());
  app.enableCors({
    origin:
      appConfig.corsOrigin === '*' ? true : appConfig.corsOrigin.split(','),
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  });

  app.setGlobalPrefix(appConfig.apiPrefix);

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
    }),
  );

  if (process.env.NODE_ENV !== 'production') {
    const swaggerConfig = new DocumentBuilder()
      .setTitle('Golden Bites API')
      .setDescription('Restaurant management backend for Golden Bites')
      .setVersion('1.0')
      .addBearerAuth()
      .build();

    const document = SwaggerModule.createDocument(app, swaggerConfig);
    SwaggerModule.setup('api/docs', app, document, {
      swaggerOptions: { persistAuthorization: true },
    });

    Logger.log(
      `Swagger docs available at http://localhost:${appConfig.port}/api/docs`,
      'Bootstrap',
    );
  }

  await app.listen(appConfig.port);

  Logger.log(
    `Golden Bites API running on http://localhost:${appConfig.port}/${appConfig.apiPrefix}`,
    'Bootstrap',
  );
}

void bootstrap();
