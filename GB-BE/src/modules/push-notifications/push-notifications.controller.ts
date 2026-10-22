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
  IsIn,
  IsNotEmpty,
  IsString,
  IsUrl,
  MaxLength,
  ValidateNested,
} from 'class-validator';
import { CurrentBusiness } from '../../common/decorators/current-business.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { RawResponse } from '../../common/decorators/raw-response.decorator';
import {
  PushNotificationsService,
  type NativePlatform,
} from './push-notifications.service';

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

class NativeTokenDto {
  @ApiProperty({ description: "This phone's Firebase Cloud Messaging token" })
  @IsString()
  @IsNotEmpty()
  @MaxLength(500)
  token: string;

  @ApiProperty({ enum: ['android', 'ios'] })
  @IsIn(['android', 'ios'])
  platform: NativePlatform;
}

class NativeTokenRemovalDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  @MaxLength(500)
  token: string;
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

  @Post('native-tokens')
  @HttpCode(HttpStatus.NO_CONTENT)
  @RawResponse()
  @ApiOperation({
    summary: 'Receive push notifications in the installed app on this phone',
  })
  async registerNativeToken(
    @CurrentUser('userId') userId: string,
    @CurrentBusiness() businessId: string,
    @Body() dto: NativeTokenDto,
  ) {
    await this.pushService.registerNativeToken(
      userId,
      businessId,
      dto.token,
      dto.platform,
    );
  }

  @Delete('native-tokens')
  @HttpCode(HttpStatus.NO_CONTENT)
  @RawResponse()
  @ApiOperation({ summary: 'Stop push notifications in the app on this phone' })
  async unregisterNativeToken(
    @CurrentUser('userId') userId: string,
    @Body() dto: NativeTokenRemovalDto,
  ) {
    await this.pushService.unregisterNativeToken(userId, dto.token);
  }
}
