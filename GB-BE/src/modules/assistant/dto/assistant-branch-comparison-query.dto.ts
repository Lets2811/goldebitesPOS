import { ApiProperty } from '@nestjs/swagger';
import { IsCalendarDay } from './assistant-sales-query.dto';

export class AssistantBranchComparisonQueryDto {
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
}
