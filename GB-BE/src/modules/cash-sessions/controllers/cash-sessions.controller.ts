import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentBusiness } from '../../../common/decorators/current-business.decorator';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';
import { Permissions } from '../../../common/decorators/permissions.decorator';
import { CashSessionQueryDto } from '../dto/cash-session-query.dto';
import { CloseCashSessionDto } from '../dto/close-cash-session.dto';
import { CreateCashMovementDto } from '../dto/create-cash-movement.dto';
import { CurrentCashSessionQueryDto } from '../dto/current-cash-session-query.dto';
import { OpenCashSessionDto } from '../dto/open-cash-session.dto';
import { ReopenCashSessionDto } from '../dto/reopen-cash-session.dto';
import { CashSessionsService } from '../services/cash-sessions.service';
import { RequiresFeature } from '../../../common/decorators/requires-feature.decorator';

@ApiTags('Cash Sessions')
@ApiBearerAuth()
@RequiresFeature('cash-register')
@Controller('cash-sessions')
export class CashSessionsController {
  constructor(private readonly cashSessionsService: CashSessionsService) {}

  @Post()
  @Permissions('cash.open')
  @ApiOperation({ summary: 'Open a cash session for a branch' })
  open(
    @CurrentBusiness() businessId: string,
    @CurrentUser('userId') actorUserId: string,
    @Body() dto: OpenCashSessionDto,
  ) {
    return this.cashSessionsService.open({ businessId, ...dto }, actorUserId);
  }

  @Get()
  @Permissions('cash.open')
  @ApiOperation({ summary: 'List cash sessions' })
  findAll(
    @CurrentBusiness() businessId: string,
    @Query() query: CashSessionQueryDto,
  ) {
    return this.cashSessionsService.findAll({
      businessId,
      page: query.page,
      limit: query.limit,
      branchId: query.branchId,
      status: query.status,
    });
  }

  @Get('current')
  @Permissions('cash.open')
  @ApiOperation({ summary: 'Get the currently open cash session for a branch' })
  findCurrent(
    @CurrentBusiness() businessId: string,
    @Query() query: CurrentCashSessionQueryDto,
  ) {
    return this.cashSessionsService.findCurrent(businessId, query.branchId);
  }

  @Get(':id')
  @Permissions('cash.open')
  @ApiOperation({ summary: 'Get a cash session with its movements' })
  findOne(@CurrentBusiness() businessId: string, @Param('id') id: string) {
    return this.cashSessionsService.findOne(businessId, id);
  }

  @Post(':id/movements')
  @Permissions('cash.withdraw')
  @ApiOperation({
    summary: 'Record a manual movement (income, expense or withdrawal)',
  })
  addMovement(
    @CurrentBusiness() businessId: string,
    @CurrentUser('userId') actorUserId: string,
    @Param('id') id: string,
    @Body() dto: CreateCashMovementDto,
  ) {
    return this.cashSessionsService.recordMovement(
      businessId,
      id,
      dto.movementType,
      dto.amount,
      dto.description,
      actorUserId,
    );
  }

  @Post(':id/close')
  @Permissions('cash.close')
  @ApiOperation({
    summary: 'Close a cash session and compute the cash difference',
  })
  close(
    @CurrentBusiness() businessId: string,
    @CurrentUser('userId') actorUserId: string,
    @Param('id') id: string,
    @Body() dto: CloseCashSessionDto,
  ) {
    return this.cashSessionsService.close(businessId, id, dto, actorUserId);
  }

  @Post(':id/reopen')
  @Permissions('cash.reopen')
  @RequiresFeature('cash-register.rectification')
  @ApiOperation({
    summary:
      'Rectificar caja — reopen a closed session for correction (requires the admin master key)',
  })
  reopen(
    @CurrentBusiness() businessId: string,
    @CurrentUser('userId') actorUserId: string,
    @Param('id') id: string,
    @Body() dto: ReopenCashSessionDto,
  ) {
    return this.cashSessionsService.reopenForCorrection(
      businessId,
      id,
      dto.masterKey,
      dto.reason,
      actorUserId,
    );
  }
}
