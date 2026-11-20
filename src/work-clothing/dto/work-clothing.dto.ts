import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsDateString,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsPositive,
  IsString,
  IsUUID,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import { SearchPaginationQueryDto } from 'src/common/pagination';

export class DispatchLineDto {
  @ApiProperty()
  @Type(() => Number)
  @IsInt()
  @IsPositive()
  officeInventoryEntryId!: number;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @IsPositive()
  elementRequestId?: number;

  @ApiProperty({ minimum: 1 })
  @Type(() => Number)
  @IsInt()
  @IsPositive()
  quantity!: number;
}

export class CreateDispatchDto {
  @ApiProperty()
  @IsUUID()
  clientRequestId!: string;

  @ApiProperty()
  @Type(() => Number)
  @IsInt()
  @IsPositive()
  projectId!: number;

  @ApiProperty()
  @Type(() => Number)
  @IsInt()
  @IsPositive()
  custodianUserId!: number;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @IsPositive()
  requestId?: number;

  @ApiProperty()
  @IsDateString()
  dispatchedAt!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  observations?: string;

  @ApiProperty({ type: [DispatchLineDto] })
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => DispatchLineDto)
  items!: DispatchLineDto[];
}

export class ReceiveDispatchLineDto {
  @ApiProperty()
  @Type(() => Number)
  @IsInt()
  @IsPositive()
  dispatchItemId!: number;

  @ApiProperty({ minimum: 0 })
  @Type(() => Number)
  @IsInt()
  @Min(0)
  quantityReceived!: number;
}

export class ReceiveDispatchDto {
  @ApiProperty({ type: [ReceiveDispatchLineDto] })
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => ReceiveDispatchLineDto)
  items!: ReceiveDispatchLineDto[];

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  discrepancyNotes?: string;
}

export class CustodyLineDto {
  @ApiProperty()
  @Type(() => Number)
  @IsInt()
  @IsPositive()
  custodyBalanceId!: number;

  @ApiProperty({ minimum: 1 })
  @Type(() => Number)
  @IsInt()
  @IsPositive()
  quantity!: number;
}

export class CreateDeliveryDto {
  @ApiProperty()
  @IsUUID()
  clientRequestId!: string;

  @ApiProperty()
  @Type(() => Number)
  @IsInt()
  @IsPositive()
  projectId!: number;

  @ApiProperty()
  @Type(() => Number)
  @IsInt()
  @IsPositive()
  custodianUserId!: number;

  @ApiProperty()
  @Type(() => Number)
  @IsInt()
  @IsPositive()
  workerId!: number;

  @ApiProperty()
  @IsDateString()
  deliveredAt!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  observations?: string;

  @ApiProperty({ type: [CustodyLineDto] })
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => CustodyLineDto)
  items!: CustodyLineDto[];
}

export class AnnulDeliveryDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  @MaxLength(1000)
  reason!: string;
}

export class CancelReturnDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  @MaxLength(1000)
  reason!: string;
}

export class CreateReturnDto {
  @ApiProperty()
  @IsUUID()
  clientRequestId!: string;

  @ApiProperty()
  @Type(() => Number)
  @IsInt()
  @IsPositive()
  projectId!: number;

  @ApiProperty()
  @Type(() => Number)
  @IsInt()
  @IsPositive()
  custodianUserId!: number;

  @ApiProperty()
  @IsDateString()
  returnedAt!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  observations?: string;

  @ApiProperty({ type: [CustodyLineDto] })
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => CustodyLineDto)
  items!: CustodyLineDto[];
}

export class ListWorkClothingQueryDto extends SearchPaginationQueryDto {
  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @IsPositive()
  projectId?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @IsPositive()
  custodianUserId?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @IsPositive()
  workerId?: number;
}
