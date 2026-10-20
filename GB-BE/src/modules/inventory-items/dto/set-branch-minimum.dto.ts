import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsNumber, IsOptional, IsUUID, Min, ValidateIf } from 'class-validator';

export class BranchMinimumsQueryDto {
  @ApiPropertyOptional({
    description: 'The branch; absent: none (no own minimums)',
  })
  @IsOptional()
  @IsUUID()
  branchId?: string;
}

export class SetBranchMinimumDto {
  @ApiPropertyOptional({
    nullable: true,
    description:
      "The branch's own minimum; null goes back to the item's general one",
  })
  @ValidateIf((_dto, value) => value !== null && value !== undefined)
  @IsNumber({ maxDecimalPlaces: 3 })
  @Min(0)
  minimumStock: number | null;
}
