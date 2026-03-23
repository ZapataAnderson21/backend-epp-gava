import { ApiProperty } from '@nestjs/swagger';
import { User } from 'src/user/entities/user.entity';

export enum RequestStatus {
  Draft = 'draft',
  InProgress = 'in_progress',
  UnderReview = 'under_review',
  Approved = 'approved',
  Rejected = 'rejected',
  Attended = 'attended',
  Completed = 'completed',
}

export enum RequestType {
  Operative = 'operative',
  Security = 'security',
  OperativeAndSecurity = 'operative_and_security',
}

export class Request {
  @ApiProperty()
  request_id!: number;

  @ApiProperty()
  registration_date!: Date;

  @ApiProperty({ enum: RequestStatus })
  status!: RequestStatus;

  @ApiProperty()
  description!: string;

  @ApiProperty()
  project_id!: number;

  @ApiProperty()
  user_id!: number;

  @ApiProperty({ enum: RequestType })
  type!: RequestType;

  @ApiProperty()
  user!: User;
}
