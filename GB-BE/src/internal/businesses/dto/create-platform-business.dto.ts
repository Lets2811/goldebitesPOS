import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsEmail,
  IsString,
  Length,
  MaxLength,
  MinLength,
} from 'class-validator';

export class CreatePlatformBusinessDto {
  @ApiProperty({ minLength: 2, maxLength: 150 })
  @IsString()
  @MinLength(2)
  @MaxLength(150)
  name: string;

  @ApiPropertyOptional({
    minLength: 3,
    maxLength: 3,
    description: 'ISO 4217 currency code',
  })
  @IsString()
  @Length(3, 3)
  currency = 'COP';

  @ApiPropertyOptional({ description: 'IANA timezone name' })
  @IsString()
  @MaxLength(60)
  timezone = 'America/Bogota';

  @ApiProperty({ minLength: 1, maxLength: 100 })
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  ownerFirstName: string;

  @ApiProperty({ minLength: 1, maxLength: 100 })
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  ownerLastName: string;

  @ApiProperty()
  @IsEmail()
  @MaxLength(150)
  ownerEmail: string;

  @ApiProperty({ minLength: 8 })
  @IsString()
  @MinLength(8)
  @MaxLength(72)
  ownerPassword: string;
}
