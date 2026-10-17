import { Controller, Get, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentBusiness } from '../../../common/decorators/current-business.decorator';
import { Permissions } from '../../../common/decorators/permissions.decorator';
import { RequiresFeature } from '../../../common/decorators/requires-feature.decorator';
import { RosterQueryDto } from '../dto/roster-query.dto';
import { RosterService } from '../services/roster.service';

@ApiTags('HR')
@ApiBearerAuth()
@Controller('hr/roster')
@RequiresFeature('employees')
export class RosterController {
  constructor(private readonly rosterService: RosterService) {}

  @Get()
  @Permissions('employees.read')
  @ApiOperation({ summary: 'Who should be working each day of a range, with approved time off marked' })
  getRoster(@CurrentBusiness() businessId: string, @Query() query: RosterQueryDto) {
    return this.rosterService.getRoster(businessId, query.from, query.to, query.branchId);
  }
}
