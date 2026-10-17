import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsDateString, IsOptional, IsUUID, Matches } from 'class-validator';

const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;

export class RosterQueryDto {
  @ApiProperty({ example: '2026-10-13' })
  @IsDateString()
  @Matches(DATE_ONLY)
  from: string;

  @ApiProperty({ example: '2026-10-19', description: 'Included; at most 62 days after from' })
  @IsDateString()
  @Matches(DATE_ONLY)
  to: string;

  @ApiPropertyOptional({ description: 'Only shifts worked at this branch (and employees without one)' })
  @IsOptional()
  @IsUUID()
  branchId?: string;
}
