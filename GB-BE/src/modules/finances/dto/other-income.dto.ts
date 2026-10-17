import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsDateString,
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
import {
  OtherIncomeDestination,
  OtherIncomePaymentMethod,
  OtherIncomeType,
} from '../domain/other-income.types';

const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;

export class CreateOtherIncomeDto {
  @ApiProperty({ enum: OtherIncomeType })
  @IsEnum(OtherIncomeType)
  incomeType: OtherIncomeType;

  @ApiProperty({ maxLength: 255, example: 'Devolución por pedido incompleto' })
  @IsString()
  @MinLength(2)
  @MaxLength(255)
  description: string;

  @ApiPropertyOptional({ maxLength: 150, example: 'Distribuidora La Fortuna' })
  @IsOptional()
  @IsString()
  @MaxLength(150)
  receivedFrom?: string;

  @ApiProperty({ minimum: 0.01 })
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.01)
  amount: number;

  @ApiProperty({ example: '2026-10-14' })
  @IsDateString()
  @Matches(DATE_ONLY)
  incomeDate: string;

  @ApiProperty({ enum: OtherIncomeDestination, description: 'Where the money went' })
  @IsEnum(OtherIncomeDestination)
  destination: OtherIncomeDestination;

  @ApiPropertyOptional({
    enum: OtherIncomePaymentMethod,
    description: 'Required when destination is CASH_OPERATIONAL: whether it counts toward the session cash or its transfers',
  })
  @IsOptional()
  @IsEnum(OtherIncomePaymentMethod)
  paymentMethod?: OtherIncomePaymentMethod;

  @ApiPropertyOptional({ description: 'CASH_OPERATIONAL: the open session that received it, when there are several' })
  @IsOptional()
  @IsUUID()
  cashSessionId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  branchId?: string;

  @ApiPropertyOptional({ maxLength: 1000 })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  notes?: string;
}

export class VoidOtherIncomeDto {
  @ApiProperty({ maxLength: 500 })
  @IsString()
  @MinLength(3)
  @MaxLength(500)
  reason: string;
}

export class OtherIncomeQueryDto {
  @ApiPropertyOptional({ example: '2026-10-01' })
  @IsOptional()
  @IsDateString()
  @Matches(DATE_ONLY)
  dateFrom?: string;

  @ApiPropertyOptional({ example: '2026-10-31' })
  @IsOptional()
  @IsDateString()
  @Matches(DATE_ONLY)
  dateTo?: string;
}
