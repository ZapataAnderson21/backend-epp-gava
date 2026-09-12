import { ApiProperty } from '@nestjs/swagger';
import { IsEnum } from 'class-validator';
import { RequestStatus } from '../enum';

export class UpdateRequestStatusDto {
  @ApiProperty({ enum: RequestStatus, enumName: 'RequestStatus' })
  @IsEnum(RequestStatus)
  status!: RequestStatus;
}
