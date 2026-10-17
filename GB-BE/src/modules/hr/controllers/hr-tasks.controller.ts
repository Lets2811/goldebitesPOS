import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentBusiness } from '../../../common/decorators/current-business.decorator';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';
import { Permissions } from '../../../common/decorators/permissions.decorator';
import { RawResponse } from '../../../common/decorators/raw-response.decorator';
import { RequiresFeature } from '../../../common/decorators/requires-feature.decorator';
import { CreateHrTaskDto, HrTaskQueryDto, SetHrTaskStatusDto, UpdateHrTaskDto } from '../dto/hr-task.dto';
import { HrTasksService } from '../services/hr-tasks.service';

@ApiTags('HR')
@ApiBearerAuth()
@Controller('hr/tasks')
@RequiresFeature('hr')
export class HrTasksController {
  constructor(private readonly hrTasksService: HrTasksService) {}

  // "mine" routes stay before the ":id"-shaped ones so "mine" is never read as an id.
  @Get('mine')
  @Permissions('hr.read')
  @ApiOperation({ summary: 'Tasks assigned to the current user' })
  findMine(@CurrentBusiness() businessId: string, @CurrentUser('userId') userId: string) {
    return this.hrTasksService.findMine(businessId, userId);
  }

  @Patch('mine/:id/status')
  @Permissions('hr.read')
  @ApiOperation({ summary: 'Move one of my own tasks (e.g. mark it done)' })
  setMyStatus(
    @CurrentBusiness() businessId: string,
    @CurrentUser('userId') userId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: SetHrTaskStatusDto,
  ) {
    return this.hrTasksService.setMyTaskStatus(businessId, userId, id, dto.status);
  }

  @Get()
  @Permissions('tasks.manage')
  @ApiOperation({ summary: "List the team's tasks" })
  findAll(@CurrentBusiness() businessId: string, @Query() query: HrTaskQueryDto) {
    return this.hrTasksService.findAll({ businessId, ...query });
  }

  @Post()
  @Permissions('tasks.manage')
  @ApiOperation({ summary: 'Create a task' })
  create(
    @CurrentBusiness() businessId: string,
    @CurrentUser('userId') userId: string,
    @Body() dto: CreateHrTaskDto,
  ) {
    return this.hrTasksService.create({
      businessId,
      createdByUserId: userId,
      title: dto.title,
      description: dto.description ?? undefined,
      assigneeEmployeeId: dto.assigneeEmployeeId ?? undefined,
      branchId: dto.branchId ?? undefined,
      priority: dto.priority,
      status: dto.status,
      dueDate: dto.dueDate ?? undefined,
    });
  }

  @Patch(':id')
  @Permissions('tasks.manage')
  @ApiOperation({ summary: 'Update a task (null clears a field)' })
  update(
    @CurrentBusiness() businessId: string,
    @CurrentUser('userId') userId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateHrTaskDto,
  ) {
    return this.hrTasksService.update(businessId, id, dto, userId);
  }

  @Delete(':id')
  @Permissions('tasks.manage')
  @HttpCode(HttpStatus.NO_CONTENT)
  @RawResponse()
  @ApiOperation({ summary: 'Delete a task' })
  async remove(
    @CurrentBusiness() businessId: string,
    @CurrentUser('userId') userId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    await this.hrTasksService.remove(businessId, id, userId);
  }
}
