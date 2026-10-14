import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentBusiness } from '../../../common/decorators/current-business.decorator';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';
import { Permissions } from '../../../common/decorators/permissions.decorator';
import { RawResponse } from '../../../common/decorators/raw-response.decorator';
import { CreateExpenseDto } from '../dto/create-expense.dto';
import { ExpenseQueryDto } from '../dto/expense-query.dto';
import { ExpenseSummaryQueryDto } from '../dto/expense-summary-query.dto';
import { ReclassifyExpenseSourceDto } from '../dto/reclassify-expense-source.dto';
import { UpdateExpenseDto } from '../dto/update-expense.dto';
import { ExpensesService } from '../services/expenses.service';
import { RequiresFeature } from '../../../common/decorators/requires-feature.decorator';

@ApiTags('Finances')
@ApiBearerAuth()
@RequiresFeature('finances')
@Controller('expenses')
export class ExpensesController {
  constructor(private readonly expensesService: ExpensesService) {}

  @Post()
  @Permissions('finances.manage')
  @ApiOperation({ summary: 'Register an expense' })
  create(
    @CurrentBusiness() businessId: string,
    @CurrentUser('userId') actorUserId: string,
    @Body() dto: CreateExpenseDto,
  ) {
    return this.expensesService.create({ businessId, ...dto }, actorUserId);
  }

  @Get()
  @Permissions('finances.read')
  @ApiOperation({ summary: 'List expenses' })
  findAll(
    @CurrentBusiness() businessId: string,
    @Query() query: ExpenseQueryDto,
  ) {
    return this.expensesService.findAll({
      businessId,
      page: query.page,
      limit: query.limit,
      category: query.category,
      paymentSource: query.paymentSource,
      dateFrom: query.dateFrom,
      dateTo: query.dateTo,
    });
  }

  @Get('summary')
  @Permissions('finances.read')
  @ApiOperation({ summary: 'Total expenses by category within a date range' })
  getSummary(
    @CurrentBusiness() businessId: string,
    @Query() query: ExpenseSummaryQueryDto,
  ) {
    return this.expensesService.getSummaryByCategory({
      businessId,
      dateFrom: query.dateFrom,
      dateTo: query.dateTo,
    });
  }

  @Get('daily')
  @Permissions('finances.read')
  @ApiOperation({ summary: 'Total expenses of each day within a date range' })
  getDailyTotals(
    @CurrentBusiness() businessId: string,
    @Query() query: ExpenseSummaryQueryDto,
  ) {
    return this.expensesService.getDailyTotals({
      businessId,
      dateFrom: query.dateFrom,
      dateTo: query.dateTo,
    });
  }

  @Patch(':id')
  @Permissions('finances.manage')
  @ApiOperation({ summary: 'Update an expense' })
  update(
    @CurrentBusiness() businessId: string,
    @CurrentUser('userId') actorUserId: string,
    @Param('id') id: string,
    @Body() dto: UpdateExpenseDto,
  ) {
    return this.expensesService.update(businessId, id, dto, actorUserId);
  }

  @Patch(':id/reclassify-source')
  @Permissions('finances.manage')
  @ApiOperation({ summary: 'Correct an expense\'s payment source via an audited reclassification (BR-08)' })
  reclassifySource(
    @CurrentBusiness() businessId: string,
    @CurrentUser('userId') actorUserId: string,
    @Param('id') id: string,
    @Body() dto: ReclassifyExpenseSourceDto,
  ) {
    return this.expensesService.reclassifySource(businessId, id, { ...dto, actorUserId });
  }

  @Delete(':id')
  @Permissions('finances.manage')
  @HttpCode(HttpStatus.NO_CONTENT)
  @RawResponse()
  @ApiOperation({ summary: 'Soft delete an expense' })
  async remove(
    @CurrentBusiness() businessId: string,
    @CurrentUser('userId') actorUserId: string,
    @Param('id') id: string,
  ) {
    await this.expensesService.softDelete(businessId, id, actorUserId);
  }
}
