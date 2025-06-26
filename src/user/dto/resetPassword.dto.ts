import { ApiProperty } from "@nestjs/swagger";

export class ResetPasswordDto {

  @ApiProperty()
  accessToken: string;

  @ApiProperty()
  newPassword: string;
}