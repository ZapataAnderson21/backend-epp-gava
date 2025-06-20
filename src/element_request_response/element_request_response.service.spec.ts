import { Test, TestingModule } from '@nestjs/testing';
import { ElementRequestResponseService } from './element_request_response.service';

describe('ElementRequestResponseService', () => {
  let service: ElementRequestResponseService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [ElementRequestResponseService],
    }).compile();

    service = module.get<ElementRequestResponseService>(ElementRequestResponseService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
