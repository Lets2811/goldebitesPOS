import {
  Body,
  Controller,
  Delete,
  Get,
  Headers,
  HttpCode,
  HttpStatus,
  Post,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiProperty,
  ApiTags,
} from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsNotEmpty,
  IsString,
  IsUrl,
  MaxLength,
  ValidateNested,
} from 'class-validator';
import { CurrentBusiness } from '../../common/decorators/current-business.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { RawResponse } from '../../common/decorators/raw-response.decorator';
import { PushNotificationsService } from './push-notifications.service';

class PushKeysDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  p256dh: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  auth: string;
}

class PushSubscriptionDto {
  @ApiProperty({ description: "The push service's endpoint for this device" })
  @IsUrl({ protocols: ['https'], require_protocol: true })
  @MaxLength(1000)
  endpoint: string;

  @ApiProperty({ type: PushKeysDto })
  @ValidateNested()
  @Type(() => PushKeysDto)
  keys: PushKeysDto;
}

class PushEndpointDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  @MaxLength(1000)
  endpoint: string;
}

/**
 * This device's push subscription, for the signed-in user. No permission
 * beyond being signed in: a user only ever subscribes themselves.
 */
@ApiTags('Push notifications')
@ApiBearerAuth()
@Controller('push')
export class PushNotificationsController {
  constructor(private readonly pushService: PushNotificationsService) {}

  @Get('public-key')
  @ApiOperation({
    summary: 'Whether push is on, and the key to subscribe with',
  })
  getPublicKey() {
    return this.pushService.getPublicKey();
  }

  @Post('subscriptions')
  @HttpCode(HttpStatus.NO_CONTENT)
  @RawResponse()
  @ApiOperation({ summary: 'Receive push notifications on this device' })
  async subscribe(
    @CurrentUser('userId') userId: string,
    @CurrentBusiness() businessId: string,
    @Body() dto: PushSubscriptionDto,
    @Headers('user-agent') userAgent?: string,
  ) {
    await this.pushService.subscribe(
      userId,
      businessId,
      dto,
      userAgent ?? null,
    );
  }

  @Delete('subscriptions')
  @HttpCode(HttpStatus.NO_CONTENT)
  @RawResponse()
  @ApiOperation({ summary: 'Stop push notifications on this device' })
  async unsubscribe(
    @CurrentUser('userId') userId: string,
    @Body() dto: PushEndpointDto,
  ) {
    await this.pushService.unsubscribe(userId, dto.endpoint);
  }
}
