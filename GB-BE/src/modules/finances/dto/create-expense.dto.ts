import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsDateString,
  IsEnum,
  IsIn,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Min,
  MaxLength,
  MinLength,
} from 'class-validator';
import { ExpensePaymentSource, SELECTABLE_EXPENSE_PAYMENT_SOURCES } from '../domain/expense.types';

export class CreateExpenseDto {
  @ApiProperty({ maxLength: 20, description: "Code of one of the business's active expense categories (GET /expense-categories)." })
  @IsString()
  @MinLength(1)
  @MaxLength(20)
  category: string;

  @ApiProperty({ minLength: 2, maxLength: 150 })
  @IsString()
  @MinLength(2)
  @MaxLength(150)
  name: string;

  @ApiProperty({ minLength: 2, maxLength: 255 })
  @IsString()
  @MinLength(2)
  @MaxLength(255)
  description: string;

  @ApiProperty({ minLength: 2, maxLength: 150 })
  @IsString()
  @MinLength(2)
  @MaxLength(150)
  responsible: string;

  @ApiProperty({ minimum: 0 })
  @IsNumber()
  @Min(0)
  amount: number;

  @ApiProperty()
  @IsDateString()
  expenseDate: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  branchId?: string;

  @ApiProperty({
    enum: SELECTABLE_EXPENSE_PAYMENT_SOURCES,
    description: 'Which fund the expense drew from — mandatory (AC-01). UNSPECIFIED_HISTORICAL is not selectable, it only exists on legacy rows.',
  })
  @IsIn(SELECTABLE_EXPENSE_PAYMENT_SOURCES)
  paymentSource: ExpensePaymentSource;

  @ApiPropertyOptional({ description: 'An existing employee who paid personally — required (or payerName) when paymentSource is PERSONAL_MONEY.' })
  @IsOptional()
  @IsUUID()
  payerEmployeeId?: string;

  @ApiPropertyOptional({ maxLength: 150, description: 'Free-text name of who paid personally, for a payer not registered as an employee (e.g. a partner).' })
  @IsOptional()
  @IsString()
  @MaxLength(150)
  payerName?: string;

  @ApiPropertyOptional({
    description: 'CASH_OPERATIONAL only — which open cash session received the money. Required only when more than one is open for the business (AC-03); auto-selected otherwise.',
  })
  @IsOptional()
  @IsUUID()
  cashSessionId?: string;
}
