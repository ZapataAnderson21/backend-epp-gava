import {
  Controller,
  Get,
  Post,
  Body,
  Delete,
  Param,
  Query,
  ParseIntPipe,
  HttpCode,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { AttendanceService } from './attendance.service';
import { CreateAttendanceDto } from './dto/create-attendance.dto';

@Controller('attendance')
export class AttendanceController {
  private readonly logger = new Logger('AttendanceController');
  constructor(private readonly attendanceService: AttendanceService) {}

  @Post()
  create(@Body() createAttendanceDto: CreateAttendanceDto) {
    this.logger.log(
      `Creating attendance with data: ${JSON.stringify(createAttendanceDto)}`,
    );
    return this.attendanceService.create(createAttendanceDto);
  }

  @Get()
  findAll(
    @Query('weekId') weekId?: string,
    @Query('projectId') projectId?: string,
    @Query('workerId') workerId?: string,
  ) {
    this.logger.log(
      `Finding all attendance records with filters - weekId: ${weekId}, projectId: ${projectId}, workerId: ${workerId}`,
    );
    return this.attendanceService.findAll(
      weekId ? Number(weekId) : undefined,
      projectId ? Number(projectId) : undefined,
      workerId ? Number(workerId) : undefined,
    );
  }

  @Delete(':id')
  remove(@Param('id', ParseIntPipe) id: number) {
    this.logger.log(`Removing attendance record with id: ${id}`);
    return this.attendanceService.remove(id);
  }
}
