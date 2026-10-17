import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsBoolean,
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
import { Transform } from 'class-transformer';
import { SupplierPaymentSource } from '../domain/supplier-payable.types';

const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;

/** A payment to a supplier: how much, from where and when. */
export class SupplierPaymentDto {
  @ApiProperty({ minimum: 0.01 })
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.01)
  amount: number;

  @ApiProperty({ enum: SupplierPaymentSource, description: 'The cash session, the cash reserve or the bank account' })
  @IsEnum(SupplierPaymentSource)
  source: SupplierPaymentSource;

  @ApiPropertyOptional({ example: '2026-10-14', description: 'Defaults to today' })
  @IsOptional()
  @IsDateString()
  @Matches(DATE_ONLY)
  paymentDate?: string;

  @ApiPropertyOptional({ description: 'CASH_OPERATIONAL: which open session paid, when there are several' })
  @IsOptional()
  @IsUUID()
  cashSessionId?: string;

  @ApiPropertyOptional({ maxLength: 500 })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  notes?: string;
}

export class SupplierPayableQueryDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  supplierId?: string;

  @ApiPropertyOptional({ description: 'Only what is still owed' })
  @IsOptional()
  @Transform(({ value }) => value === true || value === 'true')
  @IsBoolean()
  openOnly?: boolean;
}

export class VoidSupplierPayableDto {
  @ApiProperty({ maxLength: 500 })
  @IsString()
  @MinLength(3)
  @MaxLength(500)
  reason: string;
}
