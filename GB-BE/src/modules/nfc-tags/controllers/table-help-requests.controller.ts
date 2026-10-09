import {
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentBusiness } from '../../../common/decorators/current-business.decorator';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';
import { Permissions } from '../../../common/decorators/permissions.decorator';
import { TableHelpRequestQueryDto } from '../dto/table-help-request-query.dto';
import { TableHelpRequestsService } from '../services/table-help-requests.service';

/** Tables calling for staff — under the orders permissions: whoever works the orders screen answers the calls. */
@ApiTags('Table Help Requests')
@ApiBearerAuth()
@Controller('table-help-requests')
export class TableHelpRequestsController {
  constructor(private readonly helpRequestsService: TableHelpRequestsService) {}

  @Get()
  @Permissions('orders.read')
  @ApiOperation({ summary: 'List the tables currently asking for staff' })
  findPending(
    @CurrentBusiness() businessId: string,
    @Query() query: TableHelpRequestQueryDto,
  ) {
    return this.helpRequestsService.findPending(businessId, query.branchId);
  }

  @Patch(':id/attend')
  @Permissions('orders.update')
  @ApiOperation({ summary: "Mark a table's call as attended" })
  attend(
    @CurrentBusiness() businessId: string,
    @CurrentUser('userId') userId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.helpRequestsService.attend(businessId, id, userId);
  }
}
