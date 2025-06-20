import { Test, TestingModule } from '@nestjs/testing';
import { RequestResponseController } from './request_response.controller';
import { RequestResponseService } from './request_response.service';

describe('RequestResponseController', () => {
  let controller: RequestResponseController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [RequestResponseController],
      providers: [RequestResponseService],
    }).compile();

    controller = module.get<RequestResponseController>(RequestResponseController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
