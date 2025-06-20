import { Test, TestingModule } from '@nestjs/testing';
import { ElementRequestResponseController } from './element_request_response.controller';
import { ElementRequestResponseService } from './element_request_response.service';

describe('ElementRequestResponseController', () => {
  let controller: ElementRequestResponseController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [ElementRequestResponseController],
      providers: [ElementRequestResponseService],
    }).compile();

    controller = module.get<ElementRequestResponseController>(ElementRequestResponseController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
