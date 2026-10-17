import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

export class CreateOptionGroupDto {
  @ApiProperty({
    example: 'Salsas',
    maxLength: 40,
    description: 'Plural, as it reads above the choices',
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(40)
  name: string;

  @ApiProperty({ example: 'Salsa', maxLength: 40 })
  @IsString()
  @IsNotEmpty()
  @MaxLength(40)
  singularName: string;

  @ApiPropertyOptional({
    default: false,
    description:
      'The customer must pick at least one wherever a product offers the group',
  })
  @IsOptional()
  @IsBoolean()
  isRequired?: boolean;

  @ApiPropertyOptional({
    default: 1,
    minimum: 1,
    maximum: 20,
    description: 'The max suggested when a product starts offering the group',
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(20)
  defaultMax?: number;
}

export class UpdateOptionGroupDto extends PartialType(CreateOptionGroupDto) {
  @ApiPropertyOptional({
    description: 'Off hides the group everywhere; orders cannot carry it',
  })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class SetOptionGroupOrderDto {
  @ApiProperty({
    type: [String],
    description: 'Every group of the business, in the new order',
  })
  @IsArray()
  @ArrayMaxSize(100)
  @IsUUID('4', { each: true })
  groupIds: string[];
}

export class CreateOptionItemDto {
  @ApiProperty({ example: 'BBQ', maxLength: 120 })
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  name: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  description?: string;

  @ApiPropertyOptional({ description: 'Defaults to last in its group' })
  @IsOptional()
  @IsInt()
  @Min(0)
  displayOrder?: number;
}

export class UpdateOptionItemDto extends PartialType(CreateOptionItemDto) {
  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
