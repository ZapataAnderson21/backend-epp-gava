import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsDateString,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsPositive,
  IsString,
} from 'class-validator';

export class CreateExpiringDocumentDto {
  @ApiProperty()
  @Type(() => Number)
  @IsInt()
  @IsPositive()
  categoryId!: number;

  @ApiProperty({ example: 'Certificado de calibracion' })
  @IsString()
  @IsNotEmpty()
  title!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  documentCode?: string;

  @ApiProperty({ example: 'Equipo' })
  @IsString()
  @IsNotEmpty()
  referenceType!: string;

  @ApiProperty({ example: 'Detector multigas MX6, serie 12345' })
  @IsString()
  @IsNotEmpty()
  referenceDescription!: string;

  @ApiProperty({ example: 'OneDrive' })
  @IsString()
  @IsNotEmpty()
  storageSpace!: string;

  @ApiPropertyOptional({ example: '/SSOMA/Certificados/2026' })
  @IsOptional()
  @IsString()
  storagePath?: string;

  @ApiPropertyOptional({ example: 'Archivador azul, segundo cajon' })
  @IsOptional()
  @IsString()
  storageDescription?: string;

  @ApiPropertyOptional({ example: '2026-01-15' })
  @IsOptional()
  @IsDateString()
  issueDate?: string;

  @ApiProperty({ example: '2027-01-15' })
  @IsDateString()
  expirationDate!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  notes?: string;
}
