import { IsInt, IsNotEmpty, IsString } from 'class-validator';

export class CreateRequestWorkerDto {
  @IsInt()
  request_id: number;

  @IsString()
  @IsNotEmpty()
  full_name: string;

  @IsString()
  shoe_size: string;

  @IsString()
  pants_size: string;

  @IsString()
  shirt_size: string;
}
