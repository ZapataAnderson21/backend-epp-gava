import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from './../src/app.module';

describe('AppController (e2e)', () => {
  let app: INestApplication;

  beforeAll(() => {
    process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-jwt-secret';
  });

  beforeEach(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();
  });

  afterEach(async () => {
    await app.close();
  });

  it('/user/validateToken (POST) should return 400 when token is missing', () => {
    return request(app.getHttpServer())
      .post('/user/validateToken')
      .send({})
      .expect(400);
  });
});
