import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsNumber,
  IsOptional,
  IsString,
  MaxLength,
  Min,
} from 'class-validator';

export class CloseCashSessionDto {
  @ApiProperty({ minimum: 0 })
  @IsNumber()
  @Min(0)
  actualClosingAmount: number;

  @ApiPropertyOptional({
    minimum: 0,
    description:
      'Transfers received during the session, counted/verified against the bank.',
  })
  @IsOptional()
  @IsNumber()
  @Min(0)
  actualTransferAmount?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  notes?: string;
}
