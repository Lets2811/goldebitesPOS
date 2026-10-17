import { Body, Controller, Get, Param, ParseUUIDPipe, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentBusiness } from '../../../common/decorators/current-business.decorator';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';
import { Permissions } from '../../../common/decorators/permissions.decorator';
import { RequiresFeature } from '../../../common/decorators/requires-feature.decorator';
import { SupplierPayableQueryDto, SupplierPaymentDto } from '../dto/supplier-payment.dto';
import { SupplierPayablesService } from '../services/supplier-payables.service';

@ApiTags('Finances')
@ApiBearerAuth()
@RequiresFeature('finances')
@Controller('supplier-payables')
export class SupplierPayablesController {
  constructor(private readonly payablesService: SupplierPayablesService) {}

  @Get()
  @Permissions('finances.read')
  @ApiOperation({ summary: 'What is owed to suppliers for purchases on credit (overdue first)' })
  findAll(@CurrentBusiness() businessId: string, @Query() query: SupplierPayableQueryDto) {
    return this.payablesService.findAll({ businessId, ...query });
  }

  // Before ":id" so "summary" is never read as an id.
  @Get('summary')
  @Permissions('finances.read')
  @ApiOperation({ summary: 'Total still owed to suppliers, and how much of it is overdue' })
  getSummary(@CurrentBusiness() businessId: string) {
    return this.payablesService.getSummary(businessId);
  }

  @Get(':id')
  @Permissions('finances.read')
  @ApiOperation({ summary: 'A payable with its payments' })
  findOne(@CurrentBusiness() businessId: string, @Param('id', ParseUUIDPipe) id: string) {
    return this.payablesService.findOne(businessId, id);
  }

  @Post(':id/payments')
  @Permissions('finances.manage')
  @ApiOperation({ summary: 'Pay a supplier, from the cash session, the cash reserve or the bank account' })
  recordPayment(
    @CurrentBusiness() businessId: string,
    @CurrentUser('userId') userId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: SupplierPaymentDto,
  ) {
    return this.payablesService.recordPayment(businessId, id, dto, userId);
  }
}
