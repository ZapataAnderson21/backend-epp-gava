import { ApiProperty } from '@nestjs/swagger';

export class CreateRequestDto {
  
  @ApiProperty()
  registration_date: Date;
  
  @ApiProperty({ enum: ['draft', 'pending'] })
  status: 'draft' | 'pending';

  @ApiProperty()
  description: string;

  @ApiProperty()
  project_id: number;

  @ApiProperty()
  user_id: number;

  @ApiProperty({ enum: ["operative", "security", "operative and security"] })
  type: "operative" | "security" | "operative and security";
}
