import { ApiProperty } from '@nestjs/swagger';
import { IsBoolean } from 'class-validator';

export class SetFeatureDto {
  @ApiProperty()
  @IsBoolean()
  enabled: boolean;
}
