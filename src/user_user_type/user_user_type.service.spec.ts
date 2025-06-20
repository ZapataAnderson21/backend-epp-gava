import { Test, TestingModule } from '@nestjs/testing';
import { UserUserTypeService } from './user_user_type.service';

describe('UserUserTypeService', () => {
  let service: UserUserTypeService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [UserUserTypeService],
    }).compile();

    service = module.get<UserUserTypeService>(UserUserTypeService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
