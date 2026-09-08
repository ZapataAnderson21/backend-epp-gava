import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Post,
  Put,
  Req,
} from '@nestjs/common';
import {
  ArrayUnique,
  IsArray,
  IsInt,
  IsOptional,
  IsString,
  Length,
  MaxLength,
  Min,
} from 'class-validator';
import type { Request } from 'express';
import { PermissionsService } from './permissions.service';

class SaveRoleDto {
  @IsString() @Length(2, 80) name!: string;
  @IsOptional() @IsString() @MaxLength(500) description?: string;
  @IsArray() @ArrayUnique() @IsString({ each: true }) permissions!: string[];
  @IsOptional() @IsInt() @Min(1) version?: number;
}
class AssignRoleDto {
  @IsInt() @Min(1) userTypeId!: number;
}

@Controller('permissions')
export class PermissionsController {
  constructor(private readonly service: PermissionsService) {}
  @Get('me')
  async me(@Req() req: Request & { user: { userId: number } }) {
    return { data: await this.service.forUser(req.user.userId) };
  }
  @Get('roles') list() {
    return this.service.list();
  }
  @Post('roles') create(@Body() dto: SaveRoleDto) {
    return this.service.save(undefined, dto);
  }
  @Put('roles/:id') update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: SaveRoleDto,
  ) {
    return this.service.save(id, dto);
  }
  @Put('users/:id/role') assign(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: AssignRoleDto,
  ) {
    return this.service.assign(id, dto.userTypeId);
  }
}
