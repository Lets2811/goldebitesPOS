import { ApiProperty } from '@nestjs/swagger';
import { IsString, Matches } from 'class-validator';

export class RedeemLinkCodeDto {
  @ApiProperty({ description: 'The six-digit code generated in the POS.' })
  @IsString()
  @Matches(/^\d{6}$/)
  code: string;
}
