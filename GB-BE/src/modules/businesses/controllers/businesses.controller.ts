import { randomUUID } from 'node:crypto';
import { extname } from 'node:path';
import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Patch,
  Post,
  Res,
  UploadedFile,
  UseInterceptors,
  Put,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ApiBearerAuth,
  ApiConsumes,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { diskStorage } from 'multer';
import type { Response } from 'express';
import { CurrentBusiness } from '../../../common/decorators/current-business.decorator';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';
import { Permissions } from '../../../common/decorators/permissions.decorator';
import { RawResponse } from '../../../common/decorators/raw-response.decorator';
import { EntityNotFoundException } from '../../../common/exceptions';
import {
  storedFileExists,
  streamStoredFile,
} from '../../../common/utils/stream-file.util';
import { SetBusinessStatusDto } from '../dto/set-business-status.dto';
import { UpdateBusinessDto } from '../dto/update-business.dto';
import { UpdateComboBuilderDto } from '../dto/update-combo-builder.dto';
import { ComboBuilderTemplateDto } from '../dto/combo-builder-template.dto';
import { BusinessesService } from '../services/businesses.service';
import {
  BUSINESS_LOGOS_UPLOADS_DIR,
  ensureBusinessLogosUploadsDir,
} from '../storage/business-logo-storage.util';
import { BranchSelectionExempt } from '../../../common/decorators/branch-selection-exempt.decorator';

const ALLOWED_LOGO_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
const MAX_LOGO_SIZE_BYTES = 5 * 1024 * 1024;

ensureBusinessLogosUploadsDir();

@ApiTags('Businesses')
@ApiBearerAuth()
@Controller('businesses')
export class BusinessesController {
  constructor(private readonly businessesService: BusinessesService) {}

  @Get('me')
  @BranchSelectionExempt()
  @ApiOperation({ summary: "Get the current user's business" })
  findMine(@CurrentBusiness() businessId: string) {
    return this.businessesService.findById(businessId);
  }

  @Patch('me')
  @Permissions('businesses.manage')
  @ApiOperation({ summary: "Update the current user's business" })
  updateMine(
    @CurrentBusiness() businessId: string,
    @CurrentUser('userId') actorUserId: string,
    @Body() dto: UpdateBusinessDto,
  ) {
    return this.businessesService.update(businessId, dto, actorUserId);
  }

  @Get('me/combo-builder/template')
  @Permissions('products.read')
  @ApiOperation({ summary: 'The HTML template of "Arma tu combo", or null' })
  async getComboBuilderTemplate(@CurrentBusiness() businessId: string) {
    return {
      html: await this.businessesService.getComboBuilderTemplate(businessId),
    };
  }

  @Put('me/combo-builder/template')
  @Permissions('products.update')
  @ApiOperation({
    summary:
      'Set the HTML template of "Arma tu combo" (null: back to the default view)',
  })
  setComboBuilderTemplate(
    @CurrentBusiness() businessId: string,
    @CurrentUser('userId') actorUserId: string,
    @Body() dto: ComboBuilderTemplateDto,
  ) {
    return this.businessesService.setComboBuilderTemplate(
      businessId,
      dto.html ?? null,
      actorUserId,
    );
  }

  @Patch('me/combo-builder')
  @Permissions('products.update')
  @ApiOperation({
    summary: 'Name "Arma tu combo" (and its line) the business\'s own way',
  })
  updateComboBuilder(
    @CurrentBusiness() businessId: string,
    @CurrentUser('userId') actorUserId: string,
    @Body() dto: UpdateComboBuilderDto,
  ) {
    return this.businessesService.updateComboBuilder(
      businessId,
      dto.name ?? null,
      dto.description ?? null,
      actorUserId,
    );
  }

  @Patch('me/status')
  @Permissions('businesses.manage')
  @ApiOperation({
    summary: "Activate or deactivate the current user's business",
  })
  setMyStatus(
    @CurrentBusiness() businessId: string,
    @CurrentUser('userId') actorUserId: string,
    @Body() dto: SetBusinessStatusDto,
  ) {
    return this.businessesService.setActive(
      businessId,
      dto.isActive,
      actorUserId,
    );
  }

  @Post('me/logo')
  @Permissions('businesses.manage')
  @ApiConsumes('multipart/form-data')
  @ApiOperation({ summary: "Upload the current business's logo" })
  @UseInterceptors(
    FileInterceptor('file', {
      storage: diskStorage({
        destination: BUSINESS_LOGOS_UPLOADS_DIR,
        filename: (_req, file, cb) => {
          cb(null, `${randomUUID()}${extname(file.originalname)}`);
        },
      }),
      limits: { fileSize: MAX_LOGO_SIZE_BYTES },
      fileFilter: (_req, file, cb) => {
        if (!ALLOWED_LOGO_MIME_TYPES.includes(file.mimetype)) {
          cb(
            new BadRequestException(
              'Solo se permiten imágenes JPG, PNG o WEBP.',
            ),
            false,
          );
          return;
        }
        cb(null, true);
      },
    }),
  )
  async uploadLogo(
    @CurrentBusiness() businessId: string,
    @CurrentUser('userId') actorUserId: string,
    @UploadedFile() file: Express.Multer.File,
  ) {
    if (!file) {
      throw new BadRequestException(
        'Debes adjuntar una imagen (JPG, PNG o WEBP).',
      );
    }
    await this.businessesService.setLogo(
      businessId,
      file.path,
      file.mimetype,
      actorUserId,
    );
    return this.businessesService.findById(businessId);
  }

  @Get('me/logo')
  @BranchSelectionExempt()
  @RawResponse()
  @ApiOperation({ summary: "Stream the current business's logo" })
  async getLogo(@CurrentBusiness() businessId: string, @Res() res: Response) {
    const logo = await this.businessesService.getLogo(businessId);
    if (!logo || !(await storedFileExists(logo.logoPath))) {
      throw new EntityNotFoundException('Business logo', businessId);
    }
    streamStoredFile(res, logo.logoPath, {
      'Content-Type': logo.mimeType,
      'Cache-Control': 'private, max-age=300',
    });
  }

  @Delete('me/logo')
  @Permissions('businesses.manage')
  @HttpCode(HttpStatus.NO_CONTENT)
  @RawResponse()
  @ApiOperation({ summary: "Remove the current business's logo" })
  async removeLogo(
    @CurrentBusiness() businessId: string,
    @CurrentUser('userId') actorUserId: string,
  ) {
    await this.businessesService.clearLogo(businessId, actorUserId);
  }
}
