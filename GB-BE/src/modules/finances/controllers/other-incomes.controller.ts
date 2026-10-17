import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentBusiness } from '../../../common/decorators/current-business.decorator';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';
import { Permissions } from '../../../common/decorators/permissions.decorator';
import { RequiresFeature } from '../../../common/decorators/requires-feature.decorator';
import { CreateOtherIncomeDto, OtherIncomeQueryDto, VoidOtherIncomeDto } from '../dto/other-income.dto';
import { OtherIncomesService } from '../services/other-incomes.service';

@ApiTags('Finances')
@ApiBearerAuth()
@RequiresFeature('finances')
@Controller('other-incomes')
export class OtherIncomesController {
  constructor(private readonly otherIncomesService: OtherIncomesService) {}

  @Post()
  @Permissions('finances.manage')
  @ApiOperation({ summary: 'Record money received outside of sales, into a cash session or a fund' })
  create(
    @CurrentBusiness() businessId: string,
    @CurrentUser('userId') userId: string,
    @CurrentUser('branchId') branchId: string | null,
    @Body() dto: CreateOtherIncomeDto,
  ) {
    return this.otherIncomesService.create({ businessId, ...dto, branchId: dto.branchId ?? branchId ?? undefined }, userId);
  }

  @Get()
  @Permissions('finances.read')
  @ApiOperation({ summary: 'List other incomes, newest first (voided ones included)' })
  findAll(@CurrentBusiness() businessId: string, @Query() query: OtherIncomeQueryDto) {
    return this.otherIncomesService.findAll({ businessId, ...query });
  }

  @Patch(':id/void')
  @Permissions('finances.manage')
  @ApiOperation({ summary: 'Void an income, taking the money back out of where it went' })
  void(
    @CurrentBusiness() businessId: string,
    @CurrentUser('userId') userId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: VoidOtherIncomeDto,
  ) {
    return this.otherIncomesService.void(businessId, id, dto.reason, userId);
  }
}
