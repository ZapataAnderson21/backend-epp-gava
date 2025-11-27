import { PartialType } from '@nestjs/swagger';
import { CreateWeeklyWageDto } from './create-weekly-wage.dto';

export class UpdateWeeklyWageDto extends PartialType(CreateWeeklyWageDto) {}
