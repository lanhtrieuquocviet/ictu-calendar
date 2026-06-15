import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { ConfigService } from '@nestjs/config';
import helmet from 'helmet';
import { DataSource } from 'typeorm';
import { AppModule } from './app.module';
import { TransformInterceptor } from './common/interceptors/transform.interceptor';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const configService = app.get(ConfigService);

  app.use(helmet());

  const apiPrefix = configService.get('API_PREFIX', 'api/v1');
  app.getHttpAdapter().get(`/${apiPrefix}/health`, (_req: any, res: any) => res.json({ status: 'ok' }));

  app.setGlobalPrefix(apiPrefix);

  app.useGlobalFilters(new HttpExceptionFilter());
  app.useGlobalInterceptors(new TransformInterceptor());

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
    }),
  );

  const isDev = configService.get('NODE_ENV') === 'development';

  const frontendUrl = configService.get('FRONTEND_URL', 'http://localhost:4200');
  const allowedOrigins = isDev
    ? [frontendUrl, 'http://localhost:4200', 'http://localhost:4201']
    : [frontendUrl];
  app.enableCors({
    origin: (origin, callback) => {
      // Cho phép null origin (same-origin request qua nginx proxy, Postman, curl)
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

  const port = parseInt(configService.get('PORT', '3000'), 10);

  try {
    await app.listen(port);
  } catch (err: any) {
    if (err.code === 'EADDRINUSE') {
      console.error(`Port ${port} is already in use.`);
      console.error(
        `Run this to free it:  npx kill-port ${port}  or  netstat -ano | findstr :${port}  then  taskkill /PID <pid> /F`,
      );
      process.exit(1);
    }
    throw err;
  }

  console.log(`Application running on port ${port} [${configService.get('NODE_ENV', 'development')}]`);
  if (isDev) {
    const dataSource = app.get(DataSource);
    const db = dataSource.options as any;
    console.log(`Database: ${db.type}://${db.host}:${db.port}/${db.database}`);
    console.log(`Swagger docs: http://localhost:${port}/api/docs`);
  }
}
bootstrap();
