import { Test, TestingModule } from '@nestjs/testing';
import { UserUserTypeController } from './user_user_type.controller';
import { UserUserTypeService } from './user_user_type.service';

describe('UserUserTypeController', () => {
  let controller: UserUserTypeController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [UserUserTypeController],
      providers: [UserUserTypeService],
    }).compile();

    controller = module.get<UserUserTypeController>(UserUserTypeController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
