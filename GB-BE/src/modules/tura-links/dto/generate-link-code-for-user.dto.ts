import { ApiProperty } from '@nestjs/swagger';
import { IsUUID } from 'class-validator';

export class GenerateLinkCodeForUserDto {
  @ApiProperty({ description: 'The business user TURA will act as.' })
  @IsUUID()
  userId: string;
}
