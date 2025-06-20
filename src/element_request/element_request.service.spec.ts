import { Test, TestingModule } from '@nestjs/testing';
import { ElementRequestService } from './element_request.service';

describe('ElementRequestService', () => {
  let service: ElementRequestService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [ElementRequestService],
    }).compile();

    service = module.get<ElementRequestService>(ElementRequestService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
