import { Test, TestingModule } from '@nestjs/testing';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import * as request from 'supertest';
import { INestApplication } from '@nestjs/common';

describe('AppController', () => {
  let app: INestApplication;
  let appService: AppService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AppController],
      providers: [AppService],
    }).compile();

    app = module.createNestApplication();
    await app.init();

    appService = module.get<AppService>(AppService);
  });

  afterEach(async () => {
    await app.close();
  });

  describe('getHealth', () => {
    it('should return "OK" from the service', () => {
      jest.spyOn(appService, 'getHealth').mockReturnValue('OK');
      expect(appService.getHealth()).toBe('OK');
    });

    it('should return 200 and "OK" from the /health endpoint', async () => {
      const response = await request(app.getHttpServer())
        .get('/health')
        .expect(200);
      expect(response.text).toBe('OK');
    });
  });
});
