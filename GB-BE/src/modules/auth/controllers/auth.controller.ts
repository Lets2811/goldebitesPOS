import {
  Body,
  Controller,
  Headers,
  HttpCode,
  HttpStatus,
  Ip,
  Post,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { CurrentBusiness } from '../../../common/decorators/current-business.decorator';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';
import { Public } from '../../../common/decorators/public.decorator';
import { RawResponse } from '../../../common/decorators/raw-response.decorator';
import { SkipMustChangePassword } from '../../../common/decorators/skip-must-change-password.decorator';
import { BranchSelectionExempt } from '../../../common/decorators/branch-selection-exempt.decorator';
import { Permissions } from '../../../common/decorators/permissions.decorator';
import { UnauthorizedOperationException } from '../../../common/exceptions';
import type { AuthenticatedUser } from '../../../common/interfaces/authenticated-user.interface';
import { ChangePasswordDto } from '../dto/change-password.dto';
import { ForgotPasswordDto } from '../dto/forgot-password.dto';
import { LoginDto } from '../dto/login.dto';
import { RefreshTokenDto } from '../dto/refresh-token.dto';
import { ResetPasswordDto } from '../dto/reset-password.dto';
import { SwitchBranchDto } from '../dto/switch-branch.dto';
import { AuthService, RequestMetadata } from '../services/auth.service';

/**
 * The endpoints that take credentials keep the limit the whole API had before
 * the global one was raised for polling: guessing passwords stays as slow as it was.
 */
const CREDENTIALS_THROTTLE = { default: { limit: 100, ttl: 60000 } };

@ApiTags('Auth')
@BranchSelectionExempt()
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Public()
  @Throttle(CREDENTIALS_THROTTLE)
  @Post('login')
  @ApiOperation({ summary: 'Authenticate with email and password' })
  login(
    @Body() dto: LoginDto,
    @Ip() ip: string,
    @Headers('user-agent') userAgent?: string,
  ) {
    return this.authService.login(dto, this.meta(ip, userAgent));
  }

  @Public()
  @Post('refresh')
  @ApiOperation({
    summary: 'Exchange a refresh token for a new access/refresh token pair',
  })
  refresh(
    @Body() dto: RefreshTokenDto,
    @Ip() ip: string,
    @Headers('user-agent') userAgent?: string,
  ) {
    return this.authService.refresh(dto.refreshToken, this.meta(ip, userAgent));
  }

  @Public()
  @Post('logout')
  @HttpCode(HttpStatus.NO_CONTENT)
  @RawResponse()
  @ApiOperation({ summary: 'Revoke a refresh token' })
  async logout(@Body() dto: RefreshTokenDto) {
    await this.authService.logout(dto.refreshToken);
  }

  @Post('switch-branch')
  @Permissions('branches.switch')
  @ApiBearerAuth()
  @ApiOperation({
    summary:
      'Take the session to one branch (or all, with branchId null): a new token pair',
  })
  switchBranch(
    @CurrentUser() user: AuthenticatedUser,
    @CurrentBusiness() businessId: string,
    @Body() dto: SwitchBranchDto,
    @Ip() ip: string,
    @Headers('user-agent') userAgent?: string,
  ) {
    if (user.turaLinkId) {
      // TURA reads every branch with this permission; it never gets a POS session from it.
      throw new UnauthorizedOperationException(
        'TURA cannot open a POS session',
      );
    }
    return this.authService.switchBranch(
      user.userId,
      businessId,
      dto.branchId,
      dto.refreshToken,
      this.meta(ip, userAgent),
    );
  }

  @Post('change-password')
  @SkipMustChangePassword()
  @ApiBearerAuth()
  @ApiOperation({ summary: "Change the current user's password" })
  async changePassword(
    @CurrentUser('userId') userId: string,
    @CurrentBusiness() businessId: string,
    @Body() dto: ChangePasswordDto,
  ) {
    await this.authService.changePassword(userId, businessId, dto);
    return { message: 'Password updated successfully' };
  }

  @Public()
  @Throttle(CREDENTIALS_THROTTLE)
  @Post('forgot-password')
  @ApiOperation({ summary: 'Request a password reset link' })
  async forgotPassword(@Body() dto: ForgotPasswordDto) {
    await this.authService.forgotPassword(dto);
    return {
      message:
        'If an account exists for this email, password reset instructions have been sent',
    };
  }

  @Public()
  @Throttle(CREDENTIALS_THROTTLE)
  @Post('reset-password')
  @ApiOperation({ summary: 'Reset a password using a reset token' })
  async resetPassword(@Body() dto: ResetPasswordDto) {
    await this.authService.resetPassword(dto);
    return { message: 'Password reset successfully' };
  }

  private meta(ip: string, userAgent?: string): RequestMetadata {
    return { ipAddress: ip, userAgent };
  }
}
