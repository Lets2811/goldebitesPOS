import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsOptional,
  IsString,
  IsUUID,
  MinLength,
  ValidateIf,
} from 'class-validator';

export class SwitchBranchDto {
  @ApiPropertyOptional({
    nullable: true,
    description: 'The branch to work at; null works across all of them',
  })
  @ValidateIf((_dto, value) => value !== null)
  @IsUUID()
  branchId: string | null;

  @ApiPropertyOptional({
    description: 'The current refresh token, revoked once replaced',
  })
  @IsOptional()
  @IsString()
  @MinLength(1)
  refreshToken?: string;
}
