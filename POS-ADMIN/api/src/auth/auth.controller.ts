import { Body, Controller, Get, Headers, HttpCode, HttpStatus, Ip, Post } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { IsEmail, IsString, MaxLength, MinLength } from 'class-validator';
import { CurrentAdmin, Public, SkipMustChangePassword } from './auth.decorators';
import { AuthService } from './auth.service';

class LoginDto {
  @IsEmail()
  email: string;

  @IsString()
  @MinLength(1)
  password: string;
}

class RefreshTokenDto {
  @IsString()
  @MinLength(1)
  refreshToken: string;
}

class ChangePasswordDto {
  @IsString()
  currentPassword: string;

  @IsString()
  @MinLength(8)
  @MaxLength(72)
  newPassword: string;
}

/** Few tries per minute: these accounts can change every business on the platform. */
const LOGIN_THROTTLE = { default: { limit: 10, ttl: 60_000 } };

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Public()
  @Throttle(LOGIN_THROTTLE)
  @Post('login')
  @HttpCode(HttpStatus.OK)
  login(@Body() dto: LoginDto, @Ip() ip: string, @Headers('user-agent') userAgent?: string) {
    return this.authService.login(dto.email, dto.password, { ipAddress: ip, userAgent: userAgent ?? null });
  }

  @Public()
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  refresh(@Body() dto: RefreshTokenDto, @Ip() ip: string, @Headers('user-agent') userAgent?: string) {
    return this.authService.refresh(dto.refreshToken, { ipAddress: ip, userAgent: userAgent ?? null });
  }

  @Public()
  @Post('logout')
  @HttpCode(HttpStatus.NO_CONTENT)
  async logout(@Body() dto: RefreshTokenDto): Promise<void> {
    await this.authService.logout(dto.refreshToken);
  }

  @Get('me')
  @SkipMustChangePassword()
  me(@CurrentAdmin('id') id: string) {
    return this.authService.me(id);
  }

  @Post('change-password')
  @SkipMustChangePassword()
  @HttpCode(HttpStatus.OK)
  changePassword(
    @CurrentAdmin('id') id: string,
    @Body() dto: ChangePasswordDto,
    @Ip() ip: string,
    @Headers('user-agent') userAgent?: string,
  ) {
    return this.authService.changePassword(id, dto.currentPassword, dto.newPassword, {
      ipAddress: ip,
      userAgent: userAgent ?? null,
    });
  }
}
