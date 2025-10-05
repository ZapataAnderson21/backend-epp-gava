import { Controller, Get, Post, Body, Patch, Param, Delete } from '@nestjs/common';
import { PettyCashService } from './petty-cash.service';
import { CreatePettyCashDto } from './dto/create-petty-cash.dto';
import { UpdatePettyCashDto } from './dto/update-petty-cash.dto';

@Controller('petty-cash')
export class PettyCashController {
  constructor(private readonly pettyCashService: PettyCashService) {}

  @Post()
  create(@Body() createPettyCashDto: CreatePettyCashDto) {
    return this.pettyCashService.create(createPettyCashDto);
  }

  @Get()
  findAll() {
    return this.pettyCashService.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.pettyCashService.findOne(+id);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() updatePettyCashDto: UpdatePettyCashDto) {
    return this.pettyCashService.update(+id, updatePettyCashDto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.pettyCashService.remove(+id);
  }
}
