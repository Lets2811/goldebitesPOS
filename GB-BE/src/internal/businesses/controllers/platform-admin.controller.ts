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
  Put,
} from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { RawResponse } from '../../../common/decorators/raw-response.decorator';
import { InternalActor, InternalRoute } from '../../../internal/internal-api';
import { CreateBranchDto } from '../../../modules/branches/dto/create-branch.dto';
import { SetBranchStatusDto } from '../../../modules/branches/dto/set-branch-status.dto';
import { UpdateBranchDto } from '../../../modules/branches/dto/update-branch.dto';
import { CreatePlatformBusinessDto } from '../dto/create-platform-business.dto';
import { SetFeatureDto } from '../dto/set-feature.dto';
import { PlatformAdminService } from '../services/platform-admin.service';

/**
 * What POS-ADMIN does to businesses: create them, their branches, modules
 * and users' access, and the platform-wide flags. Internal API only (see
 * internal-api.ts); the target business always comes in the path.
 */
@ApiTags('Internal · Businesses (POS-ADMIN)')
@InternalRoute()
@Controller('internal')
export class PlatformAdminController {
  constructor(private readonly platformAdminService: PlatformAdminService) {}

  @Get('businesses')
  @ApiOperation({ summary: 'List every business on the platform' })
  listBusinesses() {
    return this.platformAdminService.listBusinesses();
  }

  @Post('businesses')
  @ApiOperation({
    summary:
      'Provision a new business with its default branch, roles, and first owner user',
  })
  createBusiness(
    @InternalActor() actorUserId: string,
    @Body() dto: CreatePlatformBusinessDto,
  ) {
    return this.platformAdminService.createBusiness(dto, actorUserId);
  }

  @Get('businesses/:id/users')
  @ApiOperation({ summary: "List a business's users (for resetting access)" })
  getBusinessUsers(@Param('id') businessId: string) {
    return this.platformAdminService.getBusinessUsers(businessId);
  }

  @Post('businesses/:id/users/:userId/reset-password')
  @ApiOperation({
    summary:
      "Reset a business user's password (returns the new temporary password once)",
  })
  resetUserPassword(
    @InternalActor() actorUserId: string,
    @Param('id') businessId: string,
    @Param('userId') userId: string,
  ) {
    return this.platformAdminService.resetUserPassword(
      businessId,
      userId,
      actorUserId,
    );
  }

  // Branches: how many a business has is what it has contracted, so they
  // are managed here and not by the business itself.

  @Get('businesses/:id/branches')
  @ApiOperation({ summary: "List a business's branches, active or not" })
  getBranches(@Param('id', ParseUUIDPipe) businessId: string) {
    return this.platformAdminService.getBranches(businessId);
  }

  @Post('businesses/:id/branches')
  @ApiOperation({ summary: 'Add a branch to a business' })
  createBranch(
    @InternalActor() actorUserId: string,
    @Param('id', ParseUUIDPipe) businessId: string,
    @Body() dto: CreateBranchDto,
  ) {
    return this.platformAdminService.createBranch(businessId, dto, actorUserId);
  }

  @Patch('businesses/:id/branches/:branchId')
  @ApiOperation({ summary: 'Rename a branch or change its contact details' })
  updateBranch(
    @InternalActor() actorUserId: string,
    @Param('id', ParseUUIDPipe) businessId: string,
    @Param('branchId', ParseUUIDPipe) branchId: string,
    @Body() dto: UpdateBranchDto,
  ) {
    return this.platformAdminService.updateBranch(
      businessId,
      branchId,
      dto,
      actorUserId,
    );
  }

  @Patch('businesses/:id/branches/:branchId/status')
  @ApiOperation({ summary: 'Activate or deactivate a branch' })
  setBranchStatus(
    @InternalActor() actorUserId: string,
    @Param('id', ParseUUIDPipe) businessId: string,
    @Param('branchId', ParseUUIDPipe) branchId: string,
    @Body() dto: SetBranchStatusDto,
  ) {
    return this.platformAdminService.setBranchStatus(
      businessId,
      branchId,
      dto.isActive,
      actorUserId,
    );
  }

  @Delete('businesses/:id/branches/:branchId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @RawResponse()
  @ApiOperation({ summary: 'Delete a branch that was never used' })
  async deleteBranch(
    @InternalActor() actorUserId: string,
    @Param('id', ParseUUIDPipe) businessId: string,
    @Param('branchId', ParseUUIDPipe) branchId: string,
  ) {
    await this.platformAdminService.deleteBranch(
      businessId,
      branchId,
      actorUserId,
    );
  }

  @Get('businesses/:id/features')
  @ApiOperation({ summary: "Get a business's effective feature catalog" })
  getFeatures(@Param('id') businessId: string) {
    return this.platformAdminService.getFeatures(businessId);
  }

  @Put('businesses/:id/features/:key')
  @ApiOperation({
    summary: 'Enable or disable a module or sub-feature for a business',
  })
  setFeature(
    @InternalActor() actorUserId: string,
    @Param('id') businessId: string,
    @Param('key') featureKey: string,
    @Body() dto: SetFeatureDto,
  ) {
    return this.platformAdminService.setFeature(
      businessId,
      featureKey,
      dto.enabled,
      actorUserId,
    );
  }

  @Get('feature-flags')
  @ApiOperation({
    summary:
      'Get the platform-wide feature flag catalog — applies to every business at once',
  })
  getFeatureFlags() {
    return this.platformAdminService.getFeatureFlags();
  }

  @Put('feature-flags/:key')
  @ApiOperation({
    summary: 'Enable or disable a feature platform-wide, for every business',
  })
  setFeatureFlag(
    @InternalActor() actorUserId: string,
    @Param('key') featureKey: string,
    @Body() dto: SetFeatureDto,
  ) {
    return this.platformAdminService.setFeatureFlag(
      featureKey,
      dto.enabled,
      actorUserId,
    );
  }
}
