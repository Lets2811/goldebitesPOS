import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  registerDecorator,
  ValidationOptions,
} from 'class-validator';
import { isCalendarDay } from '../../../common/utils/business-day.util';
import { QueryBoolean } from './query-boolean.decorator';

/** A calendar day, not an instant: the business's timezone decides when it starts and ends. */
function IsCalendarDay(options?: ValidationOptions) {
  return (target: object, propertyName: string) =>
    registerDecorator({
      name: 'isCalendarDay',
      target: target.constructor,
      propertyName,
      options: {
        message: `${propertyName} must be a calendar day written as YYYY-MM-DD`,
        ...options,
      },
      validator: {
        validate: (value: unknown) =>
          typeof value === 'string' && isCalendarDay(value),
      },
    });
}

export class AssistantSalesQueryDto {
  @ApiProperty({
    example: '2026-10-01',
    description: 'First day of the range, in the business calendar.',
  })
  @IsCalendarDay()
  dateFrom: string;

  @ApiProperty({
    example: '2026-10-13',
    description:
      'Last day of the range, included. At most 366 days after dateFrom.',
  })
  @IsCalendarDay()
  dateTo: string;

  @ApiPropertyOptional({
    enum: ['day', 'week', 'month'],
    description:
      'Adds the figures of each period. Weeks run Monday to Sunday. By day, the range may cover at most 31 days.',
  })
  @IsOptional()
  @IsIn(['day', 'week', 'month'])
  groupBy?: 'day' | 'week' | 'month';

  @ApiPropertyOptional({ default: false })
  @IsOptional()
  @QueryBoolean()
  @IsBoolean()
  includeTopProducts = false;

  @ApiPropertyOptional({ default: 5, minimum: 1, maximum: 10 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(10)
  topProductsLimit = 5;

  @ApiPropertyOptional({
    enum: ['quantity', 'revenue'],
    default: 'quantity',
    description: 'Rank products by units sold or by the money they brought in.',
  })
  @IsOptional()
  @IsIn(['quantity', 'revenue'])
  topProductsOrder: 'quantity' | 'revenue' = 'quantity';

  @ApiPropertyOptional({
    description:
      'Name of a branch to limit the figures to. Without it they cover every branch. Ignored by a business with a single branch.',
  })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  branch?: string;
}
