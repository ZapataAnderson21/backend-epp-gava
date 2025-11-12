import { Injectable, Logger } from '@nestjs/common';
import { CreatePayrollDto } from './dto/create-payroll.dto';
import { UpdatePayrollDto } from './dto/update-payroll.dto';
import { PrismaService } from 'src/prisma/prisma.service';

@Injectable()
export class PayrollService {
  
  private readonly logger = new Logger("PayrollService");

  constructor(private readonly prismaService: PrismaService) {}

  create(createPayrollDto: CreatePayrollDto) {
    return 'This action adds a new payroll';
  }

  findAll() {
    return `This action returns all payroll`;
  }

  findOne(id: number) {
    return `This action returns a #${id} payroll`;
  }

  update(id: number, updatePayrollDto: UpdatePayrollDto) {
    return `This action updates a #${id} payroll`;
  }

  remove(id: number) {
    return `This action removes a #${id} payroll`;
  }
}
