import { IsInt, IsNotEmpty, IsUUID } from 'class-validator';

export class DuplicatePurchaseOrderDto {
  @IsUUID('4')
  creationKey!: string;
  @IsInt()
  @IsNotEmpty()
  projectId!: number;
}
