import { ProductMenuAvailability } from '../domain/product.types';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsEnum,
  IsBoolean,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Min,
  MaxLength,
  MinLength,
  Max,
  ValidateNested,
} from 'class-validator';

export class ProductOptionGroupInputDto {
  @ApiProperty()
  @IsUUID()
  groupId: string;

  @ApiProperty({
    minimum: 1,
    maximum: 20,
    description: 'How many of the group the customer may pick',
  })
  @IsInt()
  @Min(1)
  @Max(20)
  maxChoices: number;
}

export class CreateProductDto {
  @ApiProperty({ minLength: 2, maxLength: 150 })
  @IsString()
  @MinLength(2)
  @MaxLength(150)
  name: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  categoryId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  description?: string;

  @ApiPropertyOptional({ maxLength: 60 })
  @IsOptional()
  @IsString()
  @MaxLength(60)
  sku?: string;

  @ApiPropertyOptional({ default: 0, minimum: 0 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  salePrice?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  imageUrl?: string;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  trackInventory?: boolean;

  @ApiPropertyOptional({
    type: [ProductOptionGroupInputDto],
    description:
      'The option groups the product offers and how many of each can be picked; replaces the whole set',
  })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(50)
  @ValidateNested({ each: true })
  @Type(() => ProductOptionGroupInputDto)
  optionGroups?: ProductOptionGroupInputDto[];

  @ApiPropertyOptional({
    enum: ProductMenuAvailability,
    default: ProductMenuAvailability.MENU,
    description:
      'Where customers ordering on their own see it: the regular menu, "Arma tu combo", or both',
  })
  @IsOptional()
  @IsEnum(ProductMenuAvailability)
  menuAvailability?: ProductMenuAvailability;
}
