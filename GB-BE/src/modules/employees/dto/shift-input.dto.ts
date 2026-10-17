import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsInt,
  IsMilitaryTime,
  IsOptional,
  IsUUID,
  Max,
  Min,
} from 'class-validator';

export class ShiftInputDto {
  @ApiProperty({
    minimum: 0,
    maximum: 6,
    description: '0 = Sunday, 6 = Saturday',
  })
  @IsInt()
  @Min(0)
  @Max(6)
  dayOfWeek: number;

  @ApiProperty({ example: '08:00', description: '24h HH:mm' })
  @IsMilitaryTime()
  startTime: string;

  @ApiProperty({ example: '16:00', description: '24h HH:mm' })
  @IsMilitaryTime()
  endTime: string;

  @ApiPropertyOptional({
    nullable: true,
    description: "Branch where this shift is worked; omit for the employee's own branch",
  })
  @IsOptional()
  @IsUUID()
  branchId?: string | null;
}
