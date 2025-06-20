import { Test, TestingModule } from '@nestjs/testing';
import { ElementController } from './element.controller';
import { ElementService } from './element.service';

describe('ElementController', () => {
  let controller: ElementController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [ElementController],
      providers: [ElementService],
    }).compile();

    controller = module.get<ElementController>(ElementController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
