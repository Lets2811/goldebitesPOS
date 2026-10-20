import { Controller, Get, Param, ParseUUIDPipe, Query } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Public } from '../../../common/decorators/public.decorator';
import { PublicMenuService } from '../services/public-menu.service';

/**
 * Read-only, unauthenticated menu view for customers — meant to be linked or
 * QR-coded (e.g. /menu/:businessId on the frontend). No @Permissions()/
 * @Roles() on this controller: there is no request.user on a public request.
 */
@ApiTags('Public Menu')
@Public()
@Controller('public/menu')
export class PublicMenuController {
  constructor(private readonly publicMenuService: PublicMenuService) {}

  @Get(':businessId')
  @ApiOperation({
    summary: 'Live menu (active categories and products) for customers to view',
  })
  getMenu(
    @Param('businessId') businessId: string,
    @Query('branchId', new ParseUUIDPipe({ optional: true })) branchId?: string,
  ) {
    return this.publicMenuService.getMenu(businessId, branchId);
  }

  @Get(':businessId/combo-template')
  @ApiOperation({
    summary:
      'The business\'s HTML template for "Arma tu combo" (null: the default view)',
  })
  async getBuilderTemplate(@Param('businessId') businessId: string) {
    return {
      html: await this.publicMenuService.getBuilderTemplate(businessId),
    };
  }
}
