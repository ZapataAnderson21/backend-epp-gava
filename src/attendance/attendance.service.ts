import { ConflictException, HttpStatus, Injectable, Logger } from '@nestjs/common';
import { CreateAttendanceDto } from './dto/create-attendance.dto';
import { UpdateAttendanceDto } from './dto/update-attendance.dto';
import { PrismaService } from 'src/prisma/prisma.service';

@Injectable()
export class AttendanceService {

  private readonly logger = new Logger("AttendanceService");

  constructor(private readonly prismaService: PrismaService) {}

  async create(createAttendanceDto: CreateAttendanceDto) {
    this.logger.log(`Creating attendance with data: ${JSON.stringify(createAttendanceDto)}`);
    
    this.logger.log(`Checking for existing attendance for workerId: ${createAttendanceDto.workerId} on date: ${createAttendanceDto.date}`);
    const existingAttendance = await this.prismaService.attendance.findFirst({
      where: {
        workerId: createAttendanceDto.workerId,
        date: createAttendanceDto.date,
      },
    });
    
    if (existingAttendance) {
      this.logger.warn(`Attendance already exists for workerId: ${createAttendanceDto.workerId} on date: ${createAttendanceDto.date}`);
      throw new ConflictException('Ya existe una asistencia para este trabajador en la fecha proporcionada.');
    }

    const attendance = await this.prismaService.attendance.create({
      data: createAttendanceDto,
    });

    this.logger.log(`Attendance created successfully with ID: ${attendance.attendanceId}`);
    return {
      message: 'Asistencia creada exitosamente.',
      statusCode: HttpStatus.CREATED,
      data: attendance
    };
  }

  async findAll(weekId?: number, projectId?: number, workerId?: number) {
    this.logger.log('Fetching all attendances (Prisma)');

    const attendances = await this.prismaService.attendance.findMany({
      where: {
        weekId,
        projectId,
        workerId,
      },
      orderBy: { attendanceId: 'desc' },
      include: {
        worker: true,
        project: true,
        week: true,
      },
    });

    if (!attendances.length) {
      this.logger.warn('No attendances found in the database');
      return {
        statusCode: HttpStatus.NOT_FOUND,
        message: 'No se han encontrado asistencias para este proyecto.',
        data: [],
      };
    }

    return {
      statusCode: HttpStatus.OK,
      message: 'Asistencias recuperadas exitosamente.',
      data: attendances,
    };
  }

  async remove(id: number) {
    this.logger.log(`Deleting attendance with ID: ${id}`);

    const attendance = await this.prismaService.attendance.delete({
      where: { attendanceId: id },
    });

    if(!attendance) {
      this.logger.warn(`Attendance with ID: ${id} not found for deletion`);
      return {
        statusCode: HttpStatus.NOT_FOUND,
        message: 'No se encontró la asistencia para eliminar.',
      };
    }

    this.logger.log(`Attendance with ID: ${id} deleted successfully`);
    return {
      statusCode: HttpStatus.OK,
      message: 'Asistencia eliminada exitosamente.',
      data: attendance,
    };
  }
}
