import { Test, TestingModule } from '@nestjs/testing';
import { UserTypeController } from './user_type.controller';
import { UserTypeService } from './user_type.service';

describe('UserTypeController', () => {
  let controller: UserTypeController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [UserTypeController],
      providers: [UserTypeService],
    }).compile();

    controller = module.get<UserTypeController>(UserTypeController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
