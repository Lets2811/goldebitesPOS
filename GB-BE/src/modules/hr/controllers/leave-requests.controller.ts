import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentBusiness } from '../../../common/decorators/current-business.decorator';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';
import { Permissions } from '../../../common/decorators/permissions.decorator';
import { RequiresFeature } from '../../../common/decorators/requires-feature.decorator';
import {
  CreateEmployeeLeaveDto,
  CreateLeaveRequestDto,
  LeaveRequestQueryDto,
  ReviewLeaveRequestDto,
} from '../dto/leave-request.dto';
import { LeaveRequestsService } from '../services/leave-requests.service';

@ApiTags('HR')
@ApiBearerAuth()
@Controller('hr/leave-requests')
@RequiresFeature('hr')
export class LeaveRequestsController {
  constructor(private readonly leaveRequestsService: LeaveRequestsService) {}

  // "mine" routes stay before the ":id"-shaped ones so "mine" is never read as an id.
  @Get('mine')
  @Permissions('hr.read')
  @ApiOperation({ summary: "The current user's own time-off requests" })
  findMine(@CurrentBusiness() businessId: string, @CurrentUser('userId') userId: string) {
    return this.leaveRequestsService.findMine(businessId, userId);
  }

  @Post('mine')
  @Permissions('hr.read')
  @ApiOperation({ summary: 'Ask for time off (stays pending until an administrator answers)' })
  requestMine(
    @CurrentBusiness() businessId: string,
    @CurrentUser('userId') userId: string,
    @Body() dto: CreateLeaveRequestDto,
  ) {
    return this.leaveRequestsService.requestMine(businessId, userId, dto);
  }

  @Patch('mine/:id/cancel')
  @Permissions('hr.read')
  @ApiOperation({ summary: 'Withdraw one of my requests while it is still pending' })
  cancelMine(
    @CurrentBusiness() businessId: string,
    @CurrentUser('userId') userId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.leaveRequestsService.cancelMine(businessId, userId, id);
  }

  @Get()
  @Permissions('leave.approve')
  @ApiOperation({ summary: "List the team's time-off requests, pending first" })
  findAll(@CurrentBusiness() businessId: string, @Query() query: LeaveRequestQueryDto) {
    return this.leaveRequestsService.findAll({ businessId, ...query });
  }

  @Post()
  @Permissions('leave.approve')
  @ApiOperation({ summary: 'Register time off for an employee (approved from the start)' })
  createForEmployee(
    @CurrentBusiness() businessId: string,
    @CurrentUser('userId') userId: string,
    @Body() dto: CreateEmployeeLeaveDto,
  ) {
    const { employeeId, ...input } = dto;
    return this.leaveRequestsService.createForEmployee(businessId, employeeId, input, userId);
  }

  @Patch(':id/review')
  @Permissions('leave.approve')
  @ApiOperation({ summary: 'Approve or reject a pending request' })
  review(
    @CurrentBusiness() businessId: string,
    @CurrentUser('userId') userId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ReviewLeaveRequestDto,
  ) {
    return this.leaveRequestsService.review(businessId, id, dto.decision, dto.note, userId);
  }
}
