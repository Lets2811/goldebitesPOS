import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, MaxLength, MinLength } from 'class-validator';

export class ReopenCashSessionDto {
  @ApiProperty({
    description: 'The shared admin master key (CASH_SESSION_MASTER_KEY)',
  })
  @IsString()
  @IsNotEmpty()
  masterKey: string;

  @ApiProperty({
    description: 'Why this closed session is being reopened for correction',
  })
  @IsString()
  @IsNotEmpty()
  @MinLength(5)
  @MaxLength(500)
  reason: string;
}
