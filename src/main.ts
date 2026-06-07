import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { NestExpressApplication } from '@nestjs/platform-express';
import { join } from 'path';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true }));
  // Serve the chat dashboard (public/index.html) at the root path.
  app.useStaticAssets(join(__dirname, '..', 'public'));
  await app.listen(process.env.PORT ?? 3000);
}
bootstrap();
