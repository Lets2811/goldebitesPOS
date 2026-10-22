import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
} from '@nestjs/common';
import { ApiOperation, ApiPropertyOptional, ApiTags } from '@nestjs/swagger';
import { IsIn, IsOptional, IsString, MaxLength } from 'class-validator';
import { InternalActor, InternalRoute } from '../../../internal/internal-api';
import { MasterKeysService } from '../services/master-keys.service';

class MasterKeyQueryDto {
  @ApiPropertyOptional({ enum: ['true', 'false'] })
  @IsOptional()
  @IsIn(['true', 'false'])
  reveal?: 'true' | 'false';
}

class ResetMasterKeyDto {
  @ApiPropertyOptional({
    description: 'A key of their choosing; empty generates one',
  })
  @IsOptional()
  @IsString()
  @MaxLength(64)
  key?: string;
}

/**
 * A business's master key, for POS-ADMIN only (internal API): recover it
 * when a restaurant forgets it, or set a new one. The POS never shows it.
 */
@ApiTags('Internal · Master keys (POS-ADMIN)')
@InternalRoute()
@Controller('internal/businesses/:businessId/master-key')
export class MasterKeysController {
  constructor(private readonly masterKeysService: MasterKeysService) {}

  @Get()
  @ApiOperation({
    summary:
      'Whether the business has its own key; ?reveal=true shows it (audited)',
  })
  status(
    @Param('businessId', ParseUUIDPipe) businessId: string,
    @Query() query: MasterKeyQueryDto,
    @InternalActor() actor: string | undefined,
  ) {
    return this.masterKeysService.status(
      businessId,
      query.reveal === 'true',
      actor,
    );
  }

  @Post('reset')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Set a new key (given, or generated); returns it once',
  })
  reset(
    @Param('businessId', ParseUUIDPipe) businessId: string,
    @Body() dto: ResetMasterKeyDto,
    @InternalActor() actor: string | undefined,
  ) {
    return this.masterKeysService.reset(businessId, actor, dto.key);
  }
}
