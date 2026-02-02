import * as path from 'node:path';
import * as fs from 'node:fs';
import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { FastifyAdapter, NestFastifyApplication } from '@nestjs/platform-fastify';
import { AppModule } from '@src/app.module';

(async () => {
  const logger = new Logger('Bootstrap');
  const port = process.env.APP_PORT || 8085;
  const origin = ["'self'"];
  const packageJsonPath = path.join(process.cwd(), 'package.json');
  const packageVersion = fs.existsSync(packageJsonPath) ? JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'))?.version : 'unknown';
  const imageTag = process.env.IMAGE_TAG || process.env.APP_IMAGE_TAG || 'not-set';
  const buildSha = process.env.GIT_SHA || process.env.BUILD_SHA || 'not-set';

  // Fastify app
  const app = await NestFactory.create<NestFastifyApplication>(
    AppModule,
    new FastifyAdapter({
      bodyLimit: 26214400 /*25MB*/,
      forceCloseConnections: true,
    }),
  );

  // Public assets
  app.useStaticAssets({
    root: path.join(__dirname, '..', 'public'),
    prefix: '/public/',
  });

  app.enableShutdownHooks();

  // Cors
  app.enableCors({
    origin: origin,
    credentials: true,
    methods: ['GET', 'POST', 'DELETE'],
  });

  logger.log(`Booting whatsapp-web-api-rest version=${packageVersion} imageTag=${imageTag} sha=${buildSha} pid=${process.pid} node=${process.version}`);
  logger.debug(`Config appPort=${port} cwd=${process.cwd()}`);

  // Ready
  await app.listen(port, '0.0.0.0', () => {
    console.log(`\n🚀 Ready on port ${port}`);
  });
})();
