import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, MaxLength } from 'class-validator';

export class UpdateComboBuilderDto {
  @ApiPropertyOptional({
    nullable: true,
    maxLength: 40,
    description: 'Its name for customers; empty or null: "Arma tu combo"',
  })
  @IsOptional()
  @IsString()
  @MaxLength(40)
  name?: string | null;

  @ApiPropertyOptional({
    nullable: true,
    maxLength: 120,
    description: 'The line under the name; empty or null: the default',
  })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  description?: string | null;
}
