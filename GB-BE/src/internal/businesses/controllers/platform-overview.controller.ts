import { Controller, Get, Param, ParseUUIDPipe, Res } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import { RawResponse } from '../../../common/decorators/raw-response.decorator';
import { EntityNotFoundException } from '../../../common/exceptions';
import {
  storedFileExists,
  streamStoredFile,
} from '../../../common/utils/stream-file.util';
import { InternalRoute } from '../../../internal/internal-api';
import { BusinessesService } from '../../../modules/businesses/services/businesses.service';
import { PlatformOverviewService } from '../services/platform-overview.service';

/**
 * The businesses as the Golden Bites team's Admin shows them: every one at a
 * glance, one in full, and its logo. Internal API only (see internal-api.ts).
 */
@ApiTags('Internal · Businesses (POS-ADMIN)')
@InternalRoute()
@Controller('internal/businesses')
export class PlatformOverviewController {
  constructor(
    private readonly overviewService: PlatformOverviewService,
    private readonly businessesService: BusinessesService,
  ) {}

  @Get('overview')
  @ApiOperation({
    summary:
      'Every business at a glance: size, recent sales, TURA and electronic invoicing',
  })
  list() {
    return this.overviewService.list();
  }

  @Get(':id/overview')
  @ApiOperation({ summary: 'Everything known about one business' })
  detail(@Param('id', ParseUUIDPipe) businessId: string) {
    return this.overviewService.detail(businessId);
  }

  @Get(':id/logo')
  @RawResponse()
  @ApiOperation({ summary: "Stream a business's logo" })
  async logo(
    @Param('id', ParseUUIDPipe) businessId: string,
    @Res() res: Response,
  ) {
    const logo = await this.businessesService.getLogo(businessId);
    if (!logo || !(await storedFileExists(logo.logoPath))) {
      throw new EntityNotFoundException('Business logo', businessId);
    }
    streamStoredFile(res, logo.logoPath, {
      'Content-Type': logo.mimeType,
      'Cache-Control': 'private, max-age=300',
    });
  }
}
