import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsUUID } from 'class-validator';

export class BranchMenuQueryDto {
  @ApiPropertyOptional({
    description: 'The branch whose menu to read; absent: the catalog as is',
  })
  @IsOptional()
  @IsUUID()
  branchId?: string;
}
