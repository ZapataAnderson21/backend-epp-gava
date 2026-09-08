import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Logger,
  ParseIntPipe,
} from '@nestjs/common';
import { UserTypeService } from './user_type.service';
import { CreateUserTypeDto } from './dto/create-user_type.dto';
import { PermissionsService } from 'src/permissions/permissions.service';

@Controller('user-type')
export class UserTypeController {
  private readonly logger = new Logger('UserTypeController');

  constructor(
    private readonly userTypeService: UserTypeService,
    private readonly permissionsService: PermissionsService,
  ) {}

  @Post()
  async create(@Body() createUserTypeDto: CreateUserTypeDto) {
    this.logger.log(`Creating user type: ${JSON.stringify(createUserTypeDto)}`);
    const result = await this.permissionsService.save(undefined, {
      name: createUserTypeDto.name,
      permissions: [],
    });
    return {
      ...result,
      message:
        'Rol creado sin permisos. Configura sus accesos en Roles y permisos.',
    };
  }

  @Get()
  async findAll() {
    this.logger.log('Fetching all user types');
    return await this.userTypeService.findAll();
  }

  @Get(':id')
  async findOne(@Param('id', ParseIntPipe) id: number) {
    this.logger.log(`Fetching user type with ID: ${id}`);
    return await this.userTypeService.findOne(id);
  }
}
