import { ApiProperty } from '@nestjs/swagger';
import { IsBoolean } from 'class-validator';

export class SetProductVisibilityDto {
  @ApiProperty({
    description:
      'Whether this product appears on customer-facing surfaces like the public menu.',
  })
  @IsBoolean()
  isVisible: boolean;
}
