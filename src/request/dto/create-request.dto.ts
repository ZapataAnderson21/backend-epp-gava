import { ApiProperty } from '@nestjs/swagger';

export class CreateRequestDto {
  @ApiProperty()
  description: string;

  @ApiProperty()
  project_id: number;

  @ApiProperty()
  user_id: number;

  @ApiProperty({ enum: ["operative", "security", "operative and security"] })
  type: "operative" | "security" | "operative and security";
}
