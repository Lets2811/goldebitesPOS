import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsDate,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import {
  DISCOUNT_KINDS,
  DISCOUNT_SOURCES,
  type DiscountKind,
  type DiscountSource,
} from './domain/discount';

export class DiscountDto {
  @ApiProperty({ enum: DISCOUNT_KINDS })
  @IsIn(DISCOUNT_KINDS)
  kind: DiscountKind;

  @ApiProperty({ example: 'Día de la madre' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  name: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(300)
  description?: string | null;

  @ApiPropertyOptional({ example: 'VERANO10', description: 'Coupons only' })
  @IsOptional()
  @IsString()
  @MaxLength(30)
  code?: string | null;

  @ApiProperty({ example: 10 })
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.01)
  @Max(100)
  percent: number;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Date)
  @IsDate()
  startsAt?: Date | null;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Date)
  @IsDate()
  endsAt?: Date | null;

  @ApiPropertyOptional({ description: 'Empty: unlimited' })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(1_000_000)
  maxUses?: number | null;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class ApplyOrderDiscountDto {
  @ApiProperty({
    enum: [...DISCOUNT_SOURCES, 'NONE'],
    description: 'NONE removes the discount',
  })
  @IsIn([...DISCOUNT_SOURCES, 'NONE'])
  source: DiscountSource | 'NONE';

  @ApiPropertyOptional({ example: 5, description: 'MANUAL: the percentage' })
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.01)
  @Max(100)
  percent?: number;

  @ApiPropertyOptional({ description: 'PROMOTION: the promotion picked' })
  @IsOptional()
  @IsUUID()
  discountId?: string;

  @ApiPropertyOptional({ example: 'VERANO10', description: 'COUPON: the code' })
  @IsOptional()
  @IsString()
  @MaxLength(30)
  code?: string;
}
