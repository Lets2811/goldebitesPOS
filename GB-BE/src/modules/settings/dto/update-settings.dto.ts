import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsNumber, IsOptional, Max, Min } from 'class-validator';

export class UpdateSettingsDto {
  @ApiPropertyOptional({
    minimum: 0,
    maximum: 1,
    description: 'Fraction, e.g. 0.19 for 19%',
  })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(1)
  taxRate?: number;

  @ApiPropertyOptional({
    description: 'Whether the checkout offers the "Descuento" section',
  })
  @IsOptional()
  @IsBoolean()
  discountsAtCheckout?: boolean;

  @ApiPropertyOptional({
    description: 'Whether the customer\'s menu opens with "Lo más pedido hoy"',
  })
  @IsOptional()
  @IsBoolean()
  menuTopSellers?: boolean;
}
