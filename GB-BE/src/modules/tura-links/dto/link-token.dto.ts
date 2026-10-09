import { ApiProperty } from '@nestjs/swagger';
import { IsString, MinLength } from 'class-validator';

export class LinkTokenDto {
  @ApiProperty()
  @IsString()
  @MinLength(1)
  linkToken: string;
}
