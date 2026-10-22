import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, MaxLength } from 'class-validator';

/** Up to ~200 KB: a template, not a site (its images go by URL). */
export const COMBO_BUILDER_TEMPLATE_MAX_LENGTH = 200_000;

export class ComboBuilderTemplateDto {
  @ApiPropertyOptional({
    nullable: true,
    description:
      'The HTML/CSS template; null or blank goes back to the default view',
  })
  @IsOptional()
  @IsString()
  @MaxLength(COMBO_BUILDER_TEMPLATE_MAX_LENGTH, {
    message:
      'La plantilla es muy grande (máximo 200 KB). Pon las imágenes por URL.',
  })
  html?: string | null;
}
