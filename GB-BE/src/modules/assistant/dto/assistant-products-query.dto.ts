import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { QueryBoolean } from './query-boolean.decorator';

export class AssistantProductsQueryDto {
  @ApiPropertyOptional({
    description: 'Matches part of the product name or SKU.',
  })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  search?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @QueryBoolean()
  @IsBoolean()
  isActive?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @QueryBoolean()
  @IsBoolean()
  isVisible?: boolean;

  @ApiPropertyOptional({ default: 10, minimum: 1, maximum: 20 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(20)
  limit = 10;

  @ApiPropertyOptional({
    enum: ['name', 'stock'],
    default: 'name',
    description:
      '"stock" ranks the products that have a stock figure (those sold straight from one inventory item) and leaves the rest out.',
  })
  @IsOptional()
  @IsIn(['name', 'stock'])
  sortBy: 'name' | 'stock' = 'name';

  @ApiPropertyOptional({ enum: ['asc', 'desc'], default: 'asc' })
  @IsOptional()
  @IsIn(['asc', 'desc'])
  sortOrder: 'asc' | 'desc' = 'asc';

  @ApiPropertyOptional({
    description:
      'Name of a branch to limit the answer to. Without it, every branch the caller may see (a user tied to one branch only ever sees theirs). Ignored by a business with a single branch.',
  })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  branch?: string;
}
