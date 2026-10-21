import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { QueryBoolean } from './query-boolean.decorator';

export class AssistantInventoryQueryDto {
  @ApiPropertyOptional({
    description: 'Matches part of the item name or SKU.',
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

  @ApiPropertyOptional({ default: 10, minimum: 1, maximum: 30 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(30)
  limit: number = 10;

  @ApiPropertyOptional({
    description:
      'Name of a branch to limit the answer to. Without it, every branch the caller may see (a user tied to one branch only ever sees theirs). Ignored by a business with a single branch.',
  })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  branch?: string;
}
