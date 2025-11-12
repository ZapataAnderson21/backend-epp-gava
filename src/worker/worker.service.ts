import { BadRequestException, ConflictException, HttpStatus, Injectable, Logger } from '@nestjs/common';
import { CreateWorkerDto } from './dto/create-worker.dto';
import { UpdateWorkerDto } from './dto/update-worker.dto';
import { PrismaService } from 'src/prisma/prisma.service';
import { emptyToNull } from 'src/common/util/strings.util';
import {WorkerTypeLabelEs, type WorkerType} from './enum/worker-type.enum';

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

    const data = { 
      ...createWorkerDto,
      phone: emptyToNull(createWorkerDto.phone),
      personalEmail: emptyToNull(createWorkerDto.personalEmail),
     };

    const worker = await this.prismaService.worker.create({
      data
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
      orderBy: {
        fullName: 'asc'
      },
      include: {
        attendances: true
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

    const proccessedList = workers.map(worker => ({
      ...worker,
      workerType: WorkerTypeLabelEs[worker.workerType as keyof typeof WorkerTypeLabelEs] || worker.workerType
    }));

    this.logger.log(`Workers retrieved successfully. Found ${workers.length} workers.`);
    return {
      statusCode: HttpStatus.OK,
      data: proccessedList,
      message: 'Trabajadores recuperados con éxito.'
    };
  }

  async findAllByWorkerType(workerType: WorkerType) {
    this.logger.log(`Finding workers for worker type: ${workerType}`);
    
    const workers = await this.prismaService.worker.findMany({
      where: { 
        workerType,
        deletedAt: null 
      },
      orderBy: {
        fullName: 'asc'
      },
      include: {
        attendances: true
      }
    });

    if(!workers || workers.length === 0){
      this.logger.warn(`No workers found for worker type: ${workerType}`);
      return {
        statusCode: HttpStatus.NOT_FOUND,
        data: [],
        message: 'No se encontraron trabajadores para el tipo especificado.'
      };
    }

    this.logger.log(`Workers retrieved successfully for worker type ${workerType}: ${JSON.stringify(workers)}`);
    return {
      statusCode: HttpStatus.OK,
      data: workers,
      message: 'Trabajadores recuperados con éxito.'
    };
  }

  async findOne(workerId: number) {
    this.logger.log(`Retrieving worker with ID: ${workerId}`);
    const worker = await this.prismaService.worker.findUnique({
      where: { workerId, deletedAt: null }
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

    if (dto.phone !== undefined) data.phone = emptyToNull(dto.phone);
    if (dto.personalEmail !== undefined) data.personalEmail = emptyToNull(dto.personalEmail);

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

    async getProjectPayrollTotals(projectId: number) {
    this.logger.log(`Calculando totales de planilla para projectId=${projectId}`);

    // 1) Contar asistencias por trabajador en el proyecto
    const attendanceByWorker = await this.prismaService.attendance.groupBy({
      by: ['workerId'],
      where: { projectId },
      _count: { attendanceId: true },
    });

    if (attendanceByWorker.length === 0) {
      this.logger.warn(`No hay asistencias en el proyecto ${projectId}`);
      return {
        message: 'No hay asistencias registradas para este proyecto.',
        statusCode: HttpStatus.OK,
        data: {
          laborerAmount: 0,
          technicianAmount: 0,
          totalAmount: 0,
        },
      };
    }

    const workerIds = attendanceByWorker.map(a => a.workerId);

    // 2) Traer tipo de trabajador y su dailyWage vigente (último validFrom <= hoy)
    const today = new Date();
    const workers = await this.prismaService.worker.findMany({
      where: {
        workerId: { in: workerIds },
        deletedAt: null,
      },
      select: {
        workerId: true,
        workerType: true,
        dailyWages: {
          where: { validFrom: { lte: today } },
          orderBy: { validFrom: 'desc' },
          take: 1,
          select: { amount: true },
        },
      },
    });

    // 3) Indexar worker -> {type, wage}
    const byId = new Map<number, { type: string; wage: number }>();
    for (const w of workers) {
      const wage = w.dailyWages[0]?.amount ?? 0; // Prisma Decimal o undefined
      const wageNum = typeof wage === 'number' ? wage : Number(wage);
      byId.set(w.workerId, { type: w.workerType, wage: wageNum || 0 });
    }

    // 4) Acumular montos por tipo
    let laborerAmount = 0;
    let technicianAmount = 0;

    for (const row of attendanceByWorker) {
      const info = byId.get(row.workerId);
      if (!info) continue; // trabajador borrado o sin wage vigente

      const count = row._count.attendanceId;
      const subtotal = count * info.wage;

      if (info.type === 'laborer') {
        laborerAmount += subtotal;
      } else if (info.type === 'technician') {
        technicianAmount += subtotal;
      }
      // Si quieres considerar otros tipos (engineer, etc.), agrega más ramas aquí.
    }

    const totalAmount = laborerAmount + technicianAmount;

    return {
      message: 'Totales de planilla calculados correctamente.',
      statusCode: HttpStatus.OK,
      data: {
        laborerAmount: Number(laborerAmount.toFixed(2)),
        technicianAmount: Number(technicianAmount.toFixed(2)),
        totalAmount: Number(totalAmount.toFixed(2)),
      },
    };
  }
}
