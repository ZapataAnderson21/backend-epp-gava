import { Test, TestingModule } from '@nestjs/testing';
import { ElementRequestController } from './element_request.controller';
import { ElementRequestService } from './element_request.service';

describe('ElementRequestController', () => {
  let controller: ElementRequestController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [ElementRequestController],
      providers: [ElementRequestService],
    }).compile();

    controller = module.get<ElementRequestController>(ElementRequestController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
