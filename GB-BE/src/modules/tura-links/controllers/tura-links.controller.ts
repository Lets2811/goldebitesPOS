import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { CurrentBusiness } from '../../../common/decorators/current-business.decorator';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';
import { Permissions } from '../../../common/decorators/permissions.decorator';
import { Public } from '../../../common/decorators/public.decorator';
import { RawResponse } from '../../../common/decorators/raw-response.decorator';
import { RequiresFeature } from '../../../common/decorators/requires-feature.decorator';
import { InternalActor, InternalRoute } from '../../../internal/internal-api';
import { GenerateLinkCodeForUserDto } from '../dto/generate-link-code-for-user.dto';
import { LinkTokenDto } from '../dto/link-token.dto';
import { RedeemLinkCodeDto } from '../dto/redeem-link-code.dto';
import { TURA_FEATURE, TuraLinksService } from '../services/tura-links.service';

/**
 * Links between this business's users and TURA, the assistant. TURA is a
 * paid module: managing links takes the business having it (granted by a
 * platform admin) besides settings.manage. The routes TURA itself calls are
 * public and identify the caller by the code or the link token they present;
 * the service refuses them once the business loses the module.
 */
@ApiTags('TURA Links')
@Controller('tura-links')
export class TuraLinksController {
  constructor(private readonly turaLinksService: TuraLinksService) {}

  @Post('codes')
  @ApiBearerAuth()
  @RequiresFeature(TURA_FEATURE)
  @Permissions('settings.manage')
  @ApiOperation({
    summary: 'Generate a one-time code that links TURA to the calling user',
  })
  generateCode(
    @CurrentBusiness() businessId: string,
    @CurrentUser('userId') actorUserId: string,
  ) {
    return this.turaLinksService.generateCode(businessId, actorUserId);
  }

  @Get()
  @ApiBearerAuth()
  @RequiresFeature(TURA_FEATURE)
  @Permissions('settings.manage')
  @ApiOperation({ summary: "List this business's users linked to TURA" })
  findAll(@CurrentBusiness() businessId: string) {
    return this.turaLinksService.findAll(businessId);
  }

  // Declared before ':id' so "me" is not read as a link id.
  @Get('me')
  @ApiBearerAuth()
  @ApiOperation({
    summary:
      'Who a TURA access token belongs to; fails once its link is revoked',
  })
  identify(
    @CurrentBusiness() businessId: string,
    @CurrentUser('turaLinkId') linkId: string | undefined,
  ) {
    return this.turaLinksService.identify(businessId, linkId);
  }

  @Delete(':id')
  @ApiBearerAuth()
  @RequiresFeature(TURA_FEATURE)
  @Permissions('settings.manage')
  @HttpCode(HttpStatus.NO_CONTENT)
  @RawResponse()
  @ApiOperation({ summary: "Unlink a user's TURA; its access stops working" })
  async revoke(
    @CurrentBusiness() businessId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    await this.turaLinksService.revoke(businessId, id);
  }

  // A six-digit code is guessable given enough tries, so this route gets a
  // far lower limit than the global one.
  @Public()
  @Post('redeem')
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  @ApiOperation({ summary: 'Exchange a link code for a TURA link token' })
  redeem(@Body() dto: RedeemLinkCodeDto) {
    return this.turaLinksService.redeemCode(dto.code);
  }

  @Public()
  @Post('token')
  @ApiOperation({
    summary: 'Exchange a TURA link token for a short-lived access token',
  })
  issueAccessToken(@Body() dto: LinkTokenDto) {
    return this.turaLinksService.issueAccessToken(dto.linkToken);
  }
}

/**
 * The platform admin connecting TURA for a business's users, so a business
 * can be set up without its staff doing it themselves. The code is said or
 * typed to TURA like any other, and the link acts as the chosen user.
 */
@ApiTags('Platform Admin')
@ApiBearerAuth()
@InternalRoute()
@Controller('internal/businesses/:businessId/tura')
export class PlatformTuraLinksController {
  constructor(private readonly turaLinksService: TuraLinksService) {}

  @Get()
  @ApiOperation({
    summary: 'Whether a business has TURA, and which of its users are linked',
  })
  getStatus(@Param('businessId', ParseUUIDPipe) businessId: string) {
    return this.turaLinksService.getPlatformStatus(businessId);
  }

  @Post('codes')
  @ApiOperation({
    summary: 'Generate a one-time code that links TURA to one of its users',
  })
  generateCode(
    @Param('businessId', ParseUUIDPipe) businessId: string,
    @InternalActor() actorUserId: string,
    @Body() dto: GenerateLinkCodeForUserDto,
  ) {
    return this.turaLinksService.generateCodeForUser(
      businessId,
      dto.userId,
      actorUserId,
    );
  }

  @Delete('links/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @RawResponse()
  @ApiOperation({ summary: "Unlink a user's TURA; its access stops working" })
  async revoke(
    @Param('businessId', ParseUUIDPipe) businessId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @InternalActor() actorUserId: string,
  ) {
    await this.turaLinksService.revokeForPlatform(businessId, id, actorUserId);
  }
}
