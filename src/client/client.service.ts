import {
  BadRequestException,
  ConflictException,
  HttpStatus,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { CreateClientDto } from './dto/create-client.dto';
import { UpdateClientDto } from './dto/update-client.dto';

@Injectable()
export class ClientService {
  private readonly logger = new Logger('ClientService');

  constructor(private readonly prismaService: PrismaService) {}

  private findByRuc(ruc: string) {
    return this.prismaService.client.findUnique({ where: { ruc } });
  }

  private findByEmail(email: string) {
    return this.prismaService.client.findUnique({ where: { email } });
  }

  private findByPhone(phone: string) {
    return this.prismaService.client.findUnique({ where: { phone } });
  }

  async create(createClientDto: CreateClientDto) {
    this.logger.log('Creating a new client');

    const byRuc = await this.findByRuc(createClientDto.ruc);
    if (byRuc) {
      throw new ConflictException({
        statusCode: HttpStatus.CONFLICT,
        message: 'Ya existe un cliente con ese RUC.',
        data: null,
      });
    }

    if (createClientDto.email) {
      const byEmail = await this.findByEmail(createClientDto.email);
      if (byEmail) {
        throw new ConflictException({
          statusCode: HttpStatus.CONFLICT,
          message: 'Ya existe un cliente con ese correo.',
          data: null,
        });
      }
    }

    if (createClientDto.phone) {
      const byPhone = await this.findByPhone(createClientDto.phone);
      if (byPhone) {
        throw new ConflictException({
          statusCode: HttpStatus.CONFLICT,
          message: 'Ya existe un cliente con ese teléfono.',
          data: null,
        });
      }
    }

    const client = await this.prismaService.client.create({
      data: createClientDto,
    });

    if (!client) {
      this.logger.error('Failed to create client');
      throw new BadRequestException('No se pudo crear el cliente.');
    }

    this.logger.log(`Client created with ID: ${client.clientId}`);
    return {
      statusCode: HttpStatus.CREATED,
      message: 'Cliente creado exitosamente.',
      data: client,
    };
  }

  async findAll() {
    this.logger.log('Fetching all clients');
    const clients = await this.prismaService.client.findMany({
      orderBy: { name: 'asc' },
    });

    if (!clients || clients.length === 0) {
      throw new NotFoundException({
        statusCode: HttpStatus.NOT_FOUND,
        message: 'No se encontraron clientes.',
        data: [],
      });
    }

    return {
      statusCode: HttpStatus.OK,
      message: 'Clientes obtenidos exitosamente.',
      data: clients,
    };
  }

  async findOne(clientId: number) {
    this.logger.log(`Fetching client with ID: ${clientId}`);
    const client = await this.prismaService.client.findUnique({
      where: { clientId },
    });

    if (!client) {
      throw new NotFoundException({
        statusCode: HttpStatus.NOT_FOUND,
        message: 'Cliente no encontrado.',
        data: null,
      });
    }

    return {
      statusCode: HttpStatus.OK,
      message: 'Cliente obtenido exitosamente.',
      data: client,
    };
  }

  async update(clientId: number, updateClientDto: UpdateClientDto) {
    this.logger.log(
      `Updating client with ID: ${clientId} - payload: ${JSON.stringify(updateClientDto)}`,
    );

    const currentWrap = await this.findOne(clientId);
    const current = currentWrap.data;

    if (
      updateClientDto.ruc &&
      updateClientDto.ruc.trim() !== current.ruc.trim()
    ) {
      const byRuc = await this.findByRuc(updateClientDto.ruc);
      if (byRuc && byRuc.clientId !== clientId) {
        throw new ConflictException({
          statusCode: HttpStatus.CONFLICT,
          message: 'Ya existe un cliente con ese RUC.',
          data: null,
        });
      }
    }

    if (
      updateClientDto.email &&
      updateClientDto.email.trim().toLowerCase() !==
        (current.email ?? '').trim().toLowerCase()
    ) {
      const byEmail = await this.findByEmail(updateClientDto.email);
      if (byEmail && byEmail.clientId !== clientId) {
        throw new ConflictException({
          statusCode: HttpStatus.CONFLICT,
          message: 'Ya existe un cliente con ese correo.',
          data: null,
        });
      }
    }

    if (
      updateClientDto.phone &&
      updateClientDto.phone.trim() !== (current.phone ?? '').trim()
    ) {
      const byPhone = await this.findByPhone(updateClientDto.phone);
      if (byPhone && byPhone.clientId !== clientId) {
        throw new ConflictException({
          statusCode: HttpStatus.CONFLICT,
          message: 'Ya existe un cliente con ese teléfono.',
          data: null,
        });
      }
    }

    const updated = await this.prismaService.client.update({
      where: { clientId },
      data: updateClientDto,
    });

    return {
      statusCode: HttpStatus.OK,
      message: 'Cliente actualizado exitosamente.',
      data: updated,
    };
  }

  async remove(clientId: number) {
    this.logger.log(`Removing client with ID: ${clientId}`);

    await this.findOne(clientId);

    const deleted = await this.prismaService.client.delete({
      where: { clientId },
    });

    return {
      statusCode: HttpStatus.OK,
      message: 'Cliente eliminado exitosamente.',
      data: deleted,
    };
  }
}
