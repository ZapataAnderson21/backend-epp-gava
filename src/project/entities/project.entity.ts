import { ApiProperty } from "@nestjs/swagger";
import { Request } from "generated/prisma";

export class Project {
  @ApiProperty()
  project_id: number;

  @ApiProperty()
  name: string;

  @ApiProperty()
  code: string;

  @ApiProperty()
  description: string;

  @ApiProperty()
  status: string;

  @ApiProperty()
  requests: Request[];
}
