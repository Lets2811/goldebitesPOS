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
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentBusiness } from '../../common/decorators/current-business.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Permissions } from '../../common/decorators/permissions.decorator';
import { RawResponse } from '../../common/decorators/raw-response.decorator';
import { RequiresFeature } from '../../common/decorators/requires-feature.decorator';
import { DiscountDto } from './discounts.dto';
import { DiscountsService } from './discounts.service';

@ApiTags('Discounts')
@ApiBearerAuth()
@RequiresFeature('discounts')
@Controller('discounts')
export class DiscountsController {
  constructor(private readonly discountsService: DiscountsService) {}

  @Get()
  @Permissions('discounts.manage')
  @ApiOperation({ summary: 'Every promotion and coupon of the business' })
  findAll(@CurrentBusiness() businessId: string) {
    return this.discountsService.findAll(businessId);
  }

  // Declared before ':id' so it is never read as an id.
  @Get('available')
  @Permissions('discounts.apply')
  @ApiOperation({
    summary: 'Promotions that can be applied right now, for checkout',
  })
  findAvailable(@CurrentBusiness() businessId: string) {
    return this.discountsService.findAvailablePromotions(businessId);
  }

  @Post()
  @Permissions('discounts.manage')
  @ApiOperation({ summary: 'Create a promotion or a coupon' })
  create(
    @CurrentBusiness() businessId: string,
    @CurrentUser('userId') actorUserId: string,
    @Body() dto: DiscountDto,
  ) {
    return this.discountsService.create(businessId, dto, actorUserId);
  }

  @Patch(':id')
  @Permissions('discounts.manage')
  @ApiOperation({
    summary: 'Edit a promotion or coupon (also to activate or deactivate it)',
  })
  update(
    @CurrentBusiness() businessId: string,
    @CurrentUser('userId') actorUserId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: DiscountDto,
  ) {
    return this.discountsService.update(businessId, id, dto, actorUserId);
  }

  @Delete(':id')
  @Permissions('discounts.manage')
  @HttpCode(HttpStatus.NO_CONTENT)
  @RawResponse()
  @ApiOperation({
    summary:
      'Delete a promotion or coupon (orders that used it keep their discount)',
  })
  async remove(
    @CurrentBusiness() businessId: string,
    @CurrentUser('userId') actorUserId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    await this.discountsService.remove(businessId, id, actorUserId);
  }
}
