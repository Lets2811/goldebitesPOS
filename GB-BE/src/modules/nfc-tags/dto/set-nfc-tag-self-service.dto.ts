import { ApiProperty } from '@nestjs/swagger';
import { IsBoolean } from 'class-validator';

export class SetNfcTagSelfServiceDto {
  @ApiProperty({
    description:
      'true: customers send their own order from the menu. false: a waiter takes it.',
  })
  @IsBoolean()
  enabled: boolean;
}
