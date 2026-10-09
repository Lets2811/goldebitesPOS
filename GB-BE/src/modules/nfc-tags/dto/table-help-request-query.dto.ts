import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsUUID } from 'class-validator';

export class TableHelpRequestQueryDto {
  @ApiPropertyOptional({
    description:
      'Limits the list to one branch; omitted, every branch of the business.',
  })
  @IsOptional()
  @IsUUID()
  branchId?: string;
}
