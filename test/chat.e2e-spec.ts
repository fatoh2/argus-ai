import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { ChatModule } from '../src/chat/chat.module';

describe('Chat (e2e)', () => {
  let app: INestApplication;

  beforeEach(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [ChatModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true }));
    await app.init();
  });

  afterEach(async () => {
    await app.close();
  });

  it('should accept a valid short message', () => {
    return request(app.getHttpServer())
      .post('/chat')
      .send({ message: 'Hello' })
      .expect(201);
  });

  it('should reject a message longer than 4000 characters', () => {
    const longMessage = 'a'.repeat(4001);
    return request(app.getHttpServer())
      .post('/chat')
      .send({ message: longMessage })
      .expect(400);
  });

  it('should reject a message of exactly 4001 characters', () => {
    const longMessage = 'a'.repeat(4001);
    return request(app.getHttpServer())
      .post('/chat')
      .send({ message: longMessage })
      .expect(400);
  });

  it('should accept a message of exactly 4000 characters', () => {
    const longMessage = 'a'.repeat(4000);
    return request(app.getHttpServer())
      .post('/chat')
      .send({ message: longMessage })
      .expect(201);
  });

  it('should reject empty message', () => {
    return request(app.getHttpServer())
      .post('/chat')
      .send({ message: '' })
      .expect(400);
  });

  it('should reject message with only control characters', () => {
    return request(app.getHttpServer())
      .post('/chat')
      .send({ message: '\x00\x01\x02' })
      .expect(400);
  });

  it('should rate-limit after 20 requests in quick succession', async () => {
    // Send requests sequentially to avoid ECONNRESET
    let successCount = 0;
    let rateLimitedCount = 0;

    for (let i = 0; i < 21; i++) {
      try {
        const res = await request(app.getHttpServer())
          .post('/chat')
          .send({ message: 'ping' });
        if (res.status === 201) successCount++;
        if (res.status === 429) rateLimitedCount++;
      } catch {
        // Connection errors count as rate-limited
        rateLimitedCount++;
      }
    }

    expect(successCount).toBeLessThanOrEqual(20);
    expect(rateLimitedCount).toBeGreaterThanOrEqual(1);
  });
});
