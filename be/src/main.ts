import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { ConfigService } from '@nestjs/config';
import helmet from 'helmet';
import { DataSource } from 'typeorm';
import { AppModule } from './app.module';
import { TransformInterceptor } from './common/interceptors/transform.interceptor';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const configService = app.get(ConfigService);

  app.use(helmet());

  app.setGlobalPrefix(configService.get('API_PREFIX', 'api/v1'));

  app.useGlobalInterceptors(new TransformInterceptor());

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
    }),
  );

  const isDev = configService.get('NODE_ENV') !== 'production';

  const frontendUrl = configService.get('FRONTEND_URL', 'http://localhost:4200');
  const allowedOrigins = isDev
    ? [frontendUrl, 'http://localhost:4200', 'http://localhost:4201']
    : [frontendUrl];
  app.enableCors({
    origin: (origin, callback) => {
      if (!origin || allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        callback(new Error(`CORS blocked: ${origin}`));
      }
    },
    credentials: true,
  });
  if (isDev) {
    const swaggerConfig = new DocumentBuilder()
      .setTitle('ICTU Calendar API')
      .setDescription('API documentation for ICTU Calendar')
      .setVersion('1.0')
      .addBearerAuth()
      .build();
    const document = SwaggerModule.createDocument(app, swaggerConfig);
    SwaggerModule.setup('api/docs', app, document);
  }

  const port = configService.get('PORT', 3000);
  await app.listen(port);

  console.log(`Application running on port ${port} [${configService.get('NODE_ENV', 'development')}]`);
  if (isDev) {
    const dataSource = app.get(DataSource);
    const db = dataSource.options as any;
    console.log(`Database: ${db.type}://${db.host}:${db.port}/${db.database}`);
    console.log(`Swagger docs: http://localhost:${port}/api/docs`);
  }
}
bootstrap();
