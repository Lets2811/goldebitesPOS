import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsDateString, IsEnum, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';
import { PaginationQueryDto } from '../../../common/pagination/pagination-query.dto';
import { ExpensePaymentSource } from '../domain/expense.types';

export class ExpenseQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({ maxLength: 20, description: "Code of one of the business's expense categories." })
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(20)
  category?: string;

  @ApiPropertyOptional({ enum: ExpensePaymentSource, description: 'Filters by source, including UNSPECIFIED_HISTORICAL (AC-09).' })
  @IsOptional()
  @IsEnum(ExpensePaymentSource)
  paymentSource?: ExpensePaymentSource;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  dateFrom?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  dateTo?: string;
}
