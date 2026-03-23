import { ApiProperty } from '@nestjs/swagger';
import { User } from './user.entity';

export class LoginResponse {
  @ApiProperty()
  user!: User;

  @ApiProperty()
  accessToken!: string;
}
