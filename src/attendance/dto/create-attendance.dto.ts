import { ApiProperty } from "@nestjs/swagger";
import { Type } from "class-transformer";
import { IsDateString, IsInt, IsPositive } from "class-validator";

export class CreateAttendanceDto {
    @ApiProperty({ example: 1 })
    @Type(() => Number)
    @IsInt()
    @IsPositive()
    workerId!: number;

    @ApiProperty({ example: 2 })
    @Type(() => Number)
    @IsInt()
    @IsPositive()
    projectId!: number;

    @ApiProperty({ example: '2025-10-20' })
    @IsDateString()
    date!: string;

    @ApiProperty({ example: 3 })
    @Type(() => Number)
    @IsInt()
    @IsPositive()
    weekId!: number;
}
