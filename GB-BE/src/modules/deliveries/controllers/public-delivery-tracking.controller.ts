import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { Public } from '../../../common/decorators/public.decorator';
import {
  CallRestaurantDto,
  MessagesQueryDto,
  SendDeliveryMessageDto,
} from '../dto/deliveries.dto';
import { DeliveryTrackingService } from '../services/delivery-tracking.service';

/**
 * The customer's tracking page: no login, the delivery's code is the key.
 * It shows the customer their own order and what it costs, never phones,
 * internal ids or the business's costs, and stops answering a few hours after
 * the delivery ends. Limits are tight on purpose: a code should not be
 * guessable by trying.
 */
@ApiTags('Public delivery tracking')
@Public()
@Controller('public/deliveries/:code')
export class PublicDeliveryTrackingController {
  constructor(private readonly trackingService: DeliveryTrackingService) {}

  @Get()
  @Throttle({ default: { limit: 30, ttl: 60000 } })
  @ApiOperation({ summary: 'Where the delivery is and how it is going' })
  get(@Param('code') code: string) {
    return this.trackingService.getPublic(code);
  }

  @Get('messages')
  @Throttle({ default: { limit: 40, ttl: 60000 } })
  @ApiOperation({ summary: 'The chat with the courier' })
  listMessages(@Param('code') code: string, @Query() query: MessagesQueryDto) {
    return this.trackingService.listPublicMessages(
      code,
      query.after ? new Date(query.after) : undefined,
    );
  }

  @Post('help')
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  @ApiOperation({
    summary:
      'Call the restaurant: it sounds on the POS until someone attends it',
  })
  callRestaurant(@Param('code') code: string, @Body() dto: CallRestaurantDto) {
    return this.trackingService.callRestaurantAsCustomer(code, dto.reason);
  }

  @Post('call-courier')
  @Throttle({ default: { limit: 4, ttl: 60000 } })
  @ApiOperation({ summary: 'Call the courier: their phone rings' })
  callCourier(@Param('code') code: string) {
    return this.trackingService.callCourierAsCustomer(code);
  }

  @Post('messages')
  @Throttle({ default: { limit: 15, ttl: 60000 } })
  @ApiOperation({ summary: 'Write to the courier' })
  send(@Param('code') code: string, @Body() dto: SendDeliveryMessageDto) {
    return this.trackingService.sendAsCustomer(code, dto.body);
  }
}
