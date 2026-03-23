import {
  Body,
  Controller,
  Delete,
  Get,
  Logger,
  Param,
  ParseIntPipe,
  Patch,
  Post,
} from '@nestjs/common';
import { ClientService } from './client.service';
import { CreateClientDto } from './dto/create-client.dto';
import { UpdateClientDto } from './dto/update-client.dto';

@Controller('client')
export class ClientController {
  private readonly logger = new Logger('ClientController');

  constructor(private readonly clientService: ClientService) {}

  @Post()
  create(@Body() createClientDto: CreateClientDto) {
    this.logger.log(`Creating client: ${JSON.stringify(createClientDto)}`);
    return this.clientService.create(createClientDto);
  }

  @Get()
  findAll() {
    this.logger.log('Finding all clients');
    return this.clientService.findAll();
  }

  @Get(':id')
  findOne(@Param('id', ParseIntPipe) id: number) {
    this.logger.log(`Finding client with ID: ${id}`);
    return this.clientService.findOne(id);
  }

  @Patch(':id')
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() updateClientDto: UpdateClientDto,
  ) {
    this.logger.log(
      `Updating client with ID: ${id}, Data: ${JSON.stringify(updateClientDto)}`,
    );
    return this.clientService.update(id, updateClientDto);
  }

  @Delete(':id')
  remove(@Param('id', ParseIntPipe) id: number) {
    this.logger.log(`Removing client with ID: ${id}`);
    return this.clientService.remove(id);
  }
}
