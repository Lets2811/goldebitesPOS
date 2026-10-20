import { Body, Controller, Get, Param, Patch, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentBusiness } from '../../../common/decorators/current-business.decorator';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';
import { Permissions } from '../../../common/decorators/permissions.decorator';
import { BranchQueryDto } from '../dto/branch-query.dto';
import { SetBranchPaymentPolicyDto } from '../dto/set-branch-payment-policy.dto';
import { SetBranchTableCountDto } from '../dto/set-branch-table-count.dto';
import { BranchesService } from '../services/branches.service';
import { BranchSelectionExempt } from '../../../common/decorators/branch-selection-exempt.decorator';

/**
 * A business's own view of its branches. It can read them and set what
 * belongs to running one (how many tables, the payment policy), but which
 * branches exist is not its to change: having more than one is an add-on,
 * so branches are created, renamed, deactivated and deleted by the platform
 * (see PlatformAdminController).
 */
@ApiTags('Branches')
@ApiBearerAuth()
@Controller('branches')
export class BranchesController {
  constructor(private readonly branchesService: BranchesService) {}

  @Get()
  @BranchSelectionExempt()
  @ApiOperation({ summary: 'List branches for the current business' })
  findAll(
    @CurrentBusiness() businessId: string,
    @Query() query: BranchQueryDto,
  ) {
    return this.branchesService.findAll({
      businessId,
      page: query.page,
      limit: query.limit,
      isActive: query.isActive,
      search: query.search,
    });
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a single branch' })
  findOne(@CurrentBusiness() businessId: string, @Param('id') id: string) {
    return this.branchesService.findOne(businessId, id);
  }

  @Patch(':id')
  @Permissions('branches.manage')
  @ApiOperation({ summary: 'Set how many tables a branch has' })
  setTableCount(
    @CurrentBusiness() businessId: string,
    @CurrentUser('userId') actorUserId: string,
    @Param('id') id: string,
    @Body() dto: SetBranchTableCountDto,
  ) {
    return this.branchesService.setTableCount(
      businessId,
      id,
      dto.tableCount,
      actorUserId,
    );
  }

  @Patch(':id/payment-policy')
  @Permissions('branches.manage')
  @ApiOperation({
    summary:
      'Set whether orders at this branch require full payment before kitchen',
  })
  setPaymentPolicy(
    @CurrentBusiness() businessId: string,
    @CurrentUser('userId') actorUserId: string,
    @Param('id') id: string,
    @Body() dto: SetBranchPaymentPolicyDto,
  ) {
    return this.branchesService.setPaymentPolicy(
      businessId,
      id,
      dto.paymentPolicy,
      actorUserId,
    );
  }
}
