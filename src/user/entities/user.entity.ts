import { ApiProperty } from "@nestjs/swagger";
import { UserUserType } from "src/user_user_type/entities/user_user_type.entity";

export class User {
  @ApiProperty()
  user_id!: number;

  @ApiProperty()
  name!: string;

  @ApiProperty()
  last_name!: string;

  @ApiProperty()
  email!: string;

  @ApiProperty()
  password!: string;

  @ApiProperty()
  user_user_type?: UserUserType;
}
