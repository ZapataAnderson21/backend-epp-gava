import { IsInt } from 'class-validator';

export class AssignUserDto {
  @IsInt()
  userId: number;
}
