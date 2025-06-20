import { Test, TestingModule } from '@nestjs/testing';
import { RequestResponseService } from './request_response.service';

describe('RequestResponseService', () => {
  let service: RequestResponseService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [RequestResponseService],
    }).compile();

    service = module.get<RequestResponseService>(RequestResponseService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
