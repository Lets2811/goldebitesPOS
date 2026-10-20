import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsBoolean,
  IsNumber,
  IsOptional,
  IsUUID,
  Min,
  ValidateIf,
} from 'class-validator';

export class BranchMenuQueryDto {
  @ApiPropertyOptional({
    description: 'The branch whose menu to read; absent: the catalog as is',
  })
  @IsOptional()
  @IsUUID()
  branchId?: string;
}

export class SetProductBranchDto {
  @ApiProperty({ description: 'Whether the branch offers the product' })
  @IsBoolean()
  isAvailable: boolean;

  @ApiPropertyOptional({
    nullable: true,
    description: "The branch's own price; null sells it at the catalog's",
  })
  @ValidateIf((_dto, value) => value !== null && value !== undefined)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  salePrice: number | null;
}
