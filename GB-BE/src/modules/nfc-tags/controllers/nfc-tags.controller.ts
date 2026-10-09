import { Body, Controller, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentBusiness } from '../../../common/decorators/current-business.decorator';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';
import { Permissions } from '../../../common/decorators/permissions.decorator';
import { CreateNfcTagDto } from '../dto/create-nfc-tag.dto';
import { NfcTagQueryDto } from '../dto/nfc-tag-query.dto';
import { SetNfcTagSelfServiceDto } from '../dto/set-nfc-tag-self-service.dto';
import { SetNfcTagStatusDto } from '../dto/set-nfc-tag-status.dto';
import { UpdateNfcTagDto } from '../dto/update-nfc-tag.dto';
import { NfcTagsService } from '../services/nfc-tags.service';

/** Administración de gallos NFC — todo bajo branches.manage, igual que el resto de la administración de sucursales. */
@ApiTags('NFC Tags')
@ApiBearerAuth()
@Controller('nfc-tags')
export class NfcTagsController {
  constructor(private readonly nfcTagsService: NfcTagsService) {}

  @Post()
  @Permissions('branches.manage')
  @ApiOperation({ summary: 'Register a new NFC tag ("gallo") bound to a branch and table' })
  register(
    @CurrentBusiness() businessId: string,
    @CurrentUser('userId') actorUserId: string,
    @Body() dto: CreateNfcTagDto,
  ) {
    return this.nfcTagsService.register({ businessId, ...dto, actorUserId });
  }

  @Get()
  @Permissions('branches.manage')
  @ApiOperation({ summary: 'List a branch\'s NFC tags' })
  findAllByBranch(@CurrentBusiness() businessId: string, @Query() query: NfcTagQueryDto) {
    return this.nfcTagsService.findAllByBranch(businessId, query.branchId);
  }

  @Patch(':id')
  @Permissions('branches.manage')
  @ApiOperation({ summary: 'Rename or reassign an NFC tag to a different branch/table' })
  update(
    @CurrentBusiness() businessId: string,
    @CurrentUser('userId') actorUserId: string,
    @Param('id') id: string,
    @Body() dto: UpdateNfcTagDto,
  ) {
    return this.nfcTagsService.update(businessId, id, dto, actorUserId);
  }

  @Patch(':id/status')
  @Permissions('branches.manage')
  @ApiOperation({ summary: 'Activate or deactivate an NFC tag' })
  setStatus(
    @CurrentBusiness() businessId: string,
    @CurrentUser('userId') actorUserId: string,
    @Param('id') id: string,
    @Body() dto: SetNfcTagStatusDto,
  ) {
    return this.nfcTagsService.setActive(businessId, id, dto.isActive, actorUserId);
  }

  @Patch(':id/self-service')
  @Permissions('branches.manage')
  @ApiOperation({ summary: 'Allow or stop customers sending their own order from this table\'s NFC menu' })
  setSelfService(
    @CurrentBusiness() businessId: string,
    @CurrentUser('userId') actorUserId: string,
    @Param('id') id: string,
    @Body() dto: SetNfcTagSelfServiceDto,
  ) {
    return this.nfcTagsService.setSelfService(businessId, id, dto.enabled, actorUserId);
  }

  @Post(':id/regenerate-token')
  @Permissions('branches.manage')
  @ApiOperation({ summary: 'Regenerate an NFC tag\'s public token — the previous link stops resolving immediately' })
  regenerateToken(
    @CurrentBusiness() businessId: string,
    @CurrentUser('userId') actorUserId: string,
    @Param('id') id: string,
  ) {
    return this.nfcTagsService.regenerateToken(businessId, id, actorUserId);
  }
}
