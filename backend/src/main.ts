import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import helmet from 'helmet';
import { NestExpressApplication } from '@nestjs/platform-express';
import { urlencoded, json } from 'express';
import { ValidationPipe } from '@nestjs/common';
import { join } from 'path';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  const port = process.env.PORT || 4008;
  const AllowedURL = process?.env?.ALLOW_WEBSITE_URLS?.split?.(',');

  app.use(
    helmet({
      contentSecurityPolicy: false,
    }),
  );
  app.use(json({ limit: '50mb' }));
  app.setViewEngine('pug');
  app.setBaseViewsDir(join(__dirname, '../..', 'views'));
  app.useStaticAssets(join(__dirname, '..', 'public'));
  app.useStaticAssets(join(process.cwd(), 'recordings'), {
    prefix: '/api/recordings',
  });
  app.use(urlencoded({ extended: true, limit: '50mb', parameterLimit: 50000 }));
  app.setGlobalPrefix('api');
  app.enableCors({
    origin: AllowedURL,
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE',
    credentials: true,
  });
  app.enable('trust proxy', true);
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );
  await app.listen(port, "0.0.0.0");
}
void bootstrap();
