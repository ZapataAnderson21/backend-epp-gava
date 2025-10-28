import { BadRequestException, ConflictException, HttpStatus, Injectable, Logger } from '@nestjs/common';
import { CreateWorkerDto } from './dto/create-worker.dto';
import { UpdateWorkerDto } from './dto/update-worker.dto';
import { PrismaService } from 'src/prisma/prisma.service';

@Injectable()
export class WorkerService {

  private readonly logger = new Logger("WorkerService");

  constructor(private readonly prismaService: PrismaService) {}

  async create(createWorkerDto: CreateWorkerDto) {
    this.logger.log(`Creating worker with data: ${JSON.stringify(createWorkerDto)}`);

    this.logger.log(`Checking for existing worker with phone: ${createWorkerDto.phone}`);
    const existsWorker = await this.findByDni(createWorkerDto.dni);

    if (existsWorker) {
      this.logger.error(`Worker with DNI: ${createWorkerDto.dni} already exists`);
      throw new ConflictException(`El trabajador con DNI ${createWorkerDto.dni} ya existe.`);
    }

    if(createWorkerDto.phone){
      this.logger.log(`Checking for existing worker with phone: ${createWorkerDto.phone}`);
      const existsPhone = await this.findByPhone(createWorkerDto.phone);

      if (existsPhone) {
        this.logger.error(`Worker with phone: ${createWorkerDto.phone} already exists`);
        throw new ConflictException(`El trabajador con teléfono ${createWorkerDto.phone} ya existe.`);
      }
    }

    this.logger.log(`Verifying worker group with ID: ${createWorkerDto.workerGroupId} exists`);
    await this.verifyWorkerGroupExists(createWorkerDto.workerGroupId);

    const worker = await this.prismaService.worker.create({
      data: createWorkerDto
    });

    if (!worker) {
      this.logger.error('Failed to create worker');
      throw new BadRequestException('Failed to create worker');
    }

    this.logger.log(`Worker created successfully: ${JSON.stringify(worker)}`);
    return {
      statusCode: HttpStatus.CREATED,
      data: worker,
      message: 'Trabajador creado con éxito.'
    };
  }

  async findAll() {
    this.logger.log('Retrieving all workers');
    const workers = await this.prismaService.worker.findMany({
      where: { 
        deletedAt: null 
      },
      include : {
        workerGroup: {
          include: {
            parentGroup: true
          }
        }
      },
      orderBy: {
        fullName: 'asc'
      }
    });

    if(!workers || workers.length === 0){
      this.logger.warn(`No workers found`);
      return {
        statusCode: HttpStatus.NOT_FOUND,
        data: [],
        message: 'No se encontraron trabajadores.'
      };
    }

    this.logger.log(`Workers retrieved successfully. Found ${workers.length} workers.`);
    return {
      statusCode: HttpStatus.OK,
      data: workers,
      message: 'Trabajadores recuperados con éxito.'
    };
  }

  async findAllByWorkerGroupId(workerGroupId: number) {
    this.logger.log(`Finding workers for worker group ID: ${workerGroupId}`);
    await this.verifyWorkerGroupExists(workerGroupId);

    const workers = await this.prismaService.worker.findMany({
      where: { 
        workerGroupId,
        deletedAt: null 
      },
      include : {
        workerGroup: {
          include: {
            parentGroup: true
          }
        }
      },
      orderBy: {
        fullName: 'asc'
      }
    });

    if(!workers || workers.length === 0){
      this.logger.warn(`No workers found for worker group ID: ${workerGroupId}`);
      return {
        statusCode: HttpStatus.NOT_FOUND,
        data: [],
        message: 'No se encontraron trabajadores para el grupo especificado.'
      };
    }

    this.logger.log(`Workers retrieved successfully for worker group ID ${workerGroupId}: ${JSON.stringify(workers)}`);
    return {
      statusCode: HttpStatus.OK,
      data: workers,
      message: 'Trabajadores recuperados con éxito.'
    };
  }

  async findOne(workerId: number) {
    this.logger.log(`Retrieving worker with ID: ${workerId}`);
    const worker = await this.prismaService.worker.findUnique({
      where: { workerId, deletedAt: null },
      include : {
        workerGroup: {
          include: {
            parentGroup: true
          }
        }
      },
    });

    if (!worker) {
      this.logger.error(`Worker with ID: ${workerId} not found`);
      throw new BadRequestException(`El trabajador con ID ${workerId} no existe.`);
    }

    this.logger.log(`Worker retrieved successfully`);
    return {
      statusCode: HttpStatus.OK,
      data: worker,
      message: 'Trabajador recuperado con éxito.'
    };
  }

  async update(workerId: number, dto: UpdateWorkerDto) {
    this.logger.log(`Updating worker with ID: ${workerId}`);
    await this.findOne(workerId);

    const data: any = { ...dto };

    if ('birthDate' in dto) {
      const v = dto.birthDate as any;

      if (v === undefined) {
        delete data.birthDate;
      } else if (v === null) {
        data.birthDate = null;
      } else if (typeof v === 'string') {
        const iso = v.length === 10 ? `${v}T00:00:00.000Z` : v;
        const d = new Date(iso);
        if (isNaN(d.getTime())) {
          throw new BadRequestException('birthDate inválida. Use formato YYYY-MM-DD o ISO-8601.');
        }
        data.birthDate = d;
      } else if (v instanceof Date) {
        if (isNaN(v.getTime())) {
          throw new BadRequestException('birthDate inválida.');
        }
        data.birthDate = v;
      } else {
        throw new BadRequestException('birthDate con tipo no soportado.');
      }
    }

    const updatedWorker = await this.prismaService.worker.update({
      where: { workerId },
      data
    });

    return {
      statusCode: HttpStatus.OK,
      data: updatedWorker,
      message: 'Usuario actualizado con éxito.'
    };
  }


  async remove(workerId: number) {
    this.logger.log(`Removing worker with ID: ${workerId}`);
    await this.findOne(workerId);

    const deletedWorker = await this.prismaService.worker.update({
      where: { workerId },
      data: { deletedAt: new Date() }
    });

    if (!deletedWorker) {
      this.logger.error(`Failed to remove worker with ID: ${workerId}`);
      throw new BadRequestException('Failed to remove worker');
    }

    this.logger.log(`Worker removed successfully: ${workerId}`);
    return {
      statusCode: HttpStatus.OK,
      message: 'Usuario eliminado con éxito.',
      data: deletedWorker
    };
  }

  async verifyWorkerGroupExists(workerGroupId: number) {
    this.logger.log(`Verifying existence of worker group with ID: ${workerGroupId}`);
    const workerGroup = await this.prismaService.workerGroup.findUnique({
      where: { workerGroupId }
    });

    if (!workerGroup) {
      this.logger.error(`Worker group with ID: ${workerGroupId} does not exist`);
      throw new BadRequestException(`El grupo de trabajadores con ID ${workerGroupId} no existe.`);
    }

    this.logger.log(`Worker group with ID: ${workerGroupId} exists`);
    return workerGroup;
  }

  async findByPhone(phone: string) {
    this.logger.log(`Finding worker with phone number: ${phone}`);
    
    const workers = await this.prismaService.worker.findMany({
      where: { 
        phone,
        deletedAt: null
      }
    });

    if (!workers || workers.length === 0) {
      this.logger.warn(`No worker found with phone number: ${phone}`);
      return null;
    }

    this.logger.log(`Worker(s) found with phone number: ${JSON.stringify(workers)}`);
    return workers;
  }

  async findByDni(dni: string) {
    this.logger.log(`Finding worker with DNI: ${dni}`);

    const worker = await this.prismaService.worker.findUnique({
      where: { 
        dni,
        deletedAt: null
      }
    });

    if (!worker) {
      this.logger.warn(`No worker found with DNI: ${dni}`);
      return null;
    }

    this.logger.log(`Worker found successfully: ${JSON.stringify(worker)}`);
    return worker
  }
}
