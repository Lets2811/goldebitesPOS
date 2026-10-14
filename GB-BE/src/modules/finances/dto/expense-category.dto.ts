import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsBoolean,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';

export class CreateExpenseCategoryDto {
  @ApiProperty({ minLength: 2, maxLength: 60 })
  @IsString()
  @MinLength(2)
  @MaxLength(60)
  name: string;

  @ApiPropertyOptional({
    description: 'Whether expenses of this kind are the cost of what was sold.',
  })
  @IsOptional()
  @IsBoolean()
  isCostOfSales?: boolean;
}

export class UpdateExpenseCategoryDto {
  @ApiPropertyOptional({ minLength: 2, maxLength: 60 })
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(60)
  name?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isCostOfSales?: boolean;

  @ApiPropertyOptional({
    description:
      'An inactive category keeps its expenses but cannot be chosen for new ones.',
  })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
