import { ApiProperty } from '@nestjs/swagger';
import { ArrayMaxSize, ArrayMinSize, IsArray, IsEnum, IsUUID } from 'class-validator';
import { CategoryOrderScope } from '../domain/product-category.types';

export class SetCategoryOrderDto {
  @ApiProperty({ enum: CategoryOrderScope, description: 'The regular menu or "Arma tu combo"' })
  @IsEnum(CategoryOrderScope)
  scope: CategoryOrderScope;

  @ApiProperty({ type: [String], description: 'Category ids from first to last' })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(200)
  @IsUUID('all', { each: true })
  categoryIds: string[];
}
