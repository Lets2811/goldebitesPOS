import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Min,
  MaxLength,
  MinLength,
} from 'class-validator';

export class CreateInventoryItemDto {
  @ApiPropertyOptional({
    description: "The branch whose list it joins; absent: the session's",
  })
  @IsOptional()
  @IsUUID()
  branchId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  categoryId?: string;

  @ApiProperty({ minLength: 2, maxLength: 150 })
  @IsString()
  @MinLength(2)
  @MaxLength(150)
  name: string;

  @ApiPropertyOptional({ maxLength: 60 })
  @IsOptional()
  @IsString()
  @MaxLength(60)
  sku?: string;

  @ApiProperty({ maxLength: 30, example: 'kg' })
  @IsString()
  @MaxLength(30)
  unit: string;

  @ApiPropertyOptional({ default: 0, minimum: 0 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  minimumStock?: number;

  @ApiPropertyOptional({ default: 0, minimum: 0 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  currentCost?: number;

  @ApiPropertyOptional({ maxLength: 100 })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  serialNumber?: string;

  @ApiPropertyOptional({ maxLength: 100 })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  brand?: string;

  @ApiPropertyOptional({ maxLength: 100 })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  model?: string;
}
