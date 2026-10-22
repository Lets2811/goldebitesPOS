import { Body, Controller, Get, Patch } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentBusiness } from '../../../common/decorators/current-business.decorator';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';
import { Permissions } from '../../../common/decorators/permissions.decorator';
import { UpdateSettingsDto } from '../dto/update-settings.dto';
import { SettingsService } from '../services/settings.service';

@ApiTags('Settings')
@ApiBearerAuth()
@Controller('settings')
export class SettingsController {
  constructor(private readonly settingsService: SettingsService) {}

  @Get()
  @Permissions('settings.manage')
  @ApiOperation({
    summary:
      'Get operational settings for the current business (tax rate, discounts at checkout)',
  })
  get(@CurrentBusiness() businessId: string) {
    return this.settingsService.get(businessId);
  }

  @Patch()
  @Permissions('settings.manage')
  @ApiOperation({
    summary: 'Update operational settings for the current business',
  })
  update(
    @CurrentBusiness() businessId: string,
    @CurrentUser('userId') actorUserId: string,
    @Body() dto: UpdateSettingsDto,
  ) {
    return this.settingsService.update(businessId, dto, actorUserId);
  }
}
