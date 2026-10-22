import { Controller, Get, Query } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiProperty,
  ApiTags,
} from '@nestjs/swagger';
import { IsDateString } from 'class-validator';
import { CurrentBusiness } from '../../common/decorators/current-business.decorator';
import { Permissions } from '../../common/decorators/permissions.decorator';
import { BranchComparisonService } from './branch-comparison.service';

export class BranchComparisonQueryDto {
  @ApiProperty()
  @IsDateString()
  dateFrom: string;

  @ApiProperty()
  @IsDateString()
  dateTo: string;
}

@ApiTags('Branch comparison')
@ApiBearerAuth()
@Controller('branch-comparison')
export class BranchComparisonController {
  constructor(private readonly service: BranchComparisonService) {}

  @Get()
  @Permissions('branches.switch')
  @ApiOperation({
    summary:
      'Every branch side by side for a range: sales, orders, ticket, discounts, expenses, waste',
  })
  compare(
    @CurrentBusiness() businessId: string,
    @Query() query: BranchComparisonQueryDto,
  ) {
    return this.service.compare(businessId, query.dateFrom, query.dateTo);
  }
}
