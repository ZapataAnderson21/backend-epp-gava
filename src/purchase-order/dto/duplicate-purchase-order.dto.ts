import { IsInt, IsNotEmpty } from 'class-validator';

export class DuplicatePurchaseOrderDto {
  @IsInt()
  @IsNotEmpty()
  projectId!: number;
}
