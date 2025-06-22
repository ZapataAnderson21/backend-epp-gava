import { ApiProperty } from "@nestjs/swagger";

export class Project {
  @ApiProperty()
  project_id: number;

  @ApiProperty()
  name: string;

  @ApiProperty()
  description: string;

  @ApiProperty()
  status: string;
}
