import { Body, Controller, Get, Param, Post, Put, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentBusiness } from '../../../common/decorators/current-business.decorator';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';
import { Permissions } from '../../../common/decorators/permissions.decorator';
import { ChecklistRunQueryDto } from '../dto/checklist-run-query.dto';
import { CompleteChecklistRunDto } from '../dto/complete-checklist-run.dto';
import { StartChecklistRunDto } from '../dto/start-checklist-run.dto';
import { UpdateRunItemResultsDto } from '../dto/update-run-item-results.dto';
import { ChecklistRunsService } from '../services/checklist-runs.service';
import { RequiresFeature } from '../../../common/decorators/requires-feature.decorator';
import { BranchOperation } from '../../../common/decorators/branch-operation.decorator';

@ApiTags('Checklists')
@ApiBearerAuth()
@RequiresFeature('checklists')
@BranchOperation()
@Controller('checklist-runs')
export class ChecklistRunsController {
  constructor(private readonly runsService: ChecklistRunsService) {}

  @Post()
  @Permissions('checklists.execute')
  @ApiOperation({ summary: 'Start a checklist run from a template' })
  start(
    @CurrentBusiness() businessId: string,
    @CurrentUser('userId') actorUserId: string,
    @Body() dto: StartChecklistRunDto,
  ) {
    return this.runsService.start({ businessId, ...dto }, actorUserId);
  }

  @Get()
  @Permissions('checklists.read')
  @ApiOperation({ summary: 'List checklist runs (history)' })
  findAll(
    @CurrentBusiness() businessId: string,
    @Query() query: ChecklistRunQueryDto,
  ) {
    return this.runsService.findAll({
      businessId,
      page: query.page,
      limit: query.limit,
      templateId: query.templateId,
      branchId: query.branchId,
      status: query.status,
    });
  }

  @Get(':id')
  @Permissions('checklists.read')
  @ApiOperation({ summary: 'Get a checklist run with its item results' })
  findOne(@CurrentBusiness() businessId: string, @Param('id') id: string) {
    return this.runsService.findOne(businessId, id);
  }

  @Put(':id/items')
  @Permissions('checklists.execute')
  @ApiOperation({ summary: 'Update checked state of a run items' })
  updateItems(
    @CurrentBusiness() businessId: string,
    @CurrentUser('userId') actorUserId: string,
    @Param('id') id: string,
    @Body() dto: UpdateRunItemResultsDto,
  ) {
    return this.runsService.updateItemResults(
      businessId,
      id,
      dto.items,
      actorUserId,
    );
  }

  @Post(':id/complete')
  @Permissions('checklists.execute')
  @ApiOperation({ summary: 'Complete a checklist run' })
  complete(
    @CurrentBusiness() businessId: string,
    @CurrentUser('userId') actorUserId: string,
    @Param('id') id: string,
    @Body() dto: CompleteChecklistRunDto,
  ) {
    return this.runsService.complete(
      businessId,
      id,
      dto.observations,
      actorUserId,
    );
  }
}
