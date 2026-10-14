import { Controller, Get, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentBusiness } from '../../../common/decorators/current-business.decorator';
import { Permissions } from '../../../common/decorators/permissions.decorator';
import { AnalyticsQueryDto } from '../dto/analytics-query.dto';
import { TopProductsQueryDto } from '../dto/top-products-query.dto';
import { AnalyticsService } from '../services/analytics.service';
import { RequiresFeature } from '../../../common/decorators/requires-feature.decorator';

@ApiTags('Analytics')
@ApiBearerAuth()
@RequiresFeature('analytics')
@Controller('analytics')
export class AnalyticsController {
  constructor(private readonly analyticsService: AnalyticsService) {}

  @Get('sales')
  @Permissions('analytics.read')
  @ApiOperation({
    summary: 'Sales (fully paid orders) grouped by calendar day within a date range',
  })
  getSales(
    @CurrentBusiness() businessId: string,
    @Query() query: AnalyticsQueryDto,
  ) {
    return this.analyticsService.getSalesByDay(
      businessId,
      query.branchId,
      query.dateFrom,
      query.dateTo,
    );
  }

  @Get('top-products')
  @Permissions('analytics.read')
  @ApiOperation({
    summary: 'Best-selling products by revenue within a date range',
  })
  getTopProducts(
    @CurrentBusiness() businessId: string,
    @Query() query: TopProductsQueryDto,
  ) {
    return this.analyticsService.getTopProducts(
      businessId,
      query.branchId,
      query.dateFrom,
      query.dateTo,
      query.limit,
    );
  }
}
