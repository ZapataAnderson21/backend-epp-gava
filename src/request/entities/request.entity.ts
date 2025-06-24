import { ApiProperty } from "@nestjs/swagger";
import { User } from "src/user/entities/user.entity";

export class Request {
  @ApiProperty()
  request_id: number;

  @ApiProperty()
  registration_date: Date;

  @ApiProperty({ enum: ['draft', 'pending', 'reviewed', 'accepted', 'rejected'] })
  status: 'draft' | 'pending' | 'reviewed' | 'accepted' | 'rejected';

  @ApiProperty()
  description: string;

  @ApiProperty()
  project_id: number;

  @ApiProperty()
  user_id: number;

  @ApiProperty({ enum: ["operative", "security", "operative and security"] })
  type: "operative" | "security" | "operative and security";

  @ApiProperty()
  user: User;
}
