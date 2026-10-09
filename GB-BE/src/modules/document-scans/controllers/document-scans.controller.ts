import { EntityNotFoundException } from '../../../common/exceptions';
import {
  storedFileExists,
  streamStoredFile,
} from '../../../common/utils/stream-file.util';
import { randomUUID } from 'node:crypto';
import { extname, join } from 'node:path';
import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
  Res,
  UploadedFile,
  UseInterceptors,
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
import { CreateDocumentScanDto } from '../dto/create-document-scan.dto';
import { DocumentScanQueryDto } from '../dto/document-scan-query.dto';
import { UpdateDocumentScanDto } from '../dto/update-document-scan.dto';
import { DocumentScansService } from '../services/document-scans.service';
import {
  DOCUMENT_SCANS_UPLOADS_DIR,
  ensureDocumentScansUploadsDir,
} from '../storage/document-scan-storage.util';
import { RequiresFeature } from '../../../common/decorators/requires-feature.decorator';

const ALLOWED_MIME_TYPES = ['image/jpeg', 'image/png', 'application/pdf'];
const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024;

ensureDocumentScansUploadsDir();

@ApiTags('Document Scans')
@ApiBearerAuth()
@RequiresFeature('documentScans')
@Controller('document-scans')
export class DocumentScansController {
  constructor(private readonly documentScansService: DocumentScansService) {}

  @Post()
  @Permissions('document_scans.manage')
  @ApiConsumes('multipart/form-data')
  @ApiOperation({
    summary: 'Upload a scanned invoice, receipt or other document',
  })
  @UseInterceptors(
    FileInterceptor('file', {
      storage: diskStorage({
        destination: DOCUMENT_SCANS_UPLOADS_DIR,
        filename: (_req, file, cb) => {
          cb(null, `${randomUUID()}${extname(file.originalname)}`);
        },
      }),
      limits: { fileSize: MAX_FILE_SIZE_BYTES },
      fileFilter: (_req, file, cb) => {
        if (!ALLOWED_MIME_TYPES.includes(file.mimetype)) {
          cb(
            new BadRequestException(
              'Solo se permiten archivos JPG, PNG o PDF.',
            ),
            false,
          );
          return;
        }
        cb(null, true);
      },
    }),
  )
  create(
    @CurrentBusiness() businessId: string,
    @CurrentUser('userId') actorUserId: string,
    @Body() dto: CreateDocumentScanDto,
    @UploadedFile() file: Express.Multer.File,
  ) {
    if (!file) {
      throw new BadRequestException(
        'Debes adjuntar un archivo (JPG, PNG o PDF).',
      );
    }
    return this.documentScansService.create(
      {
        businessId,
        category: dto.category,
        title: dto.title,
        documentDate: dto.documentDate,
        notes: dto.notes,
        originalFileName: file.originalname,
        storagePath: file.path,
        mimeType: file.mimetype,
        fileSizeBytes: file.size,
        uploadedBy: actorUserId,
      },
      actorUserId,
    );
  }

  @Get()
  @Permissions('document_scans.read')
  @ApiOperation({ summary: 'List document scans' })
  findAll(
    @CurrentBusiness() businessId: string,
    @Query() query: DocumentScanQueryDto,
  ) {
    return this.documentScansService.findAll({
      businessId,
      page: query.page,
      limit: query.limit,
      category: query.category,
      search: query.search,
    });
  }

  @Get(':id/file')
  @Permissions('document_scans.read')
  @RawResponse()
  @ApiOperation({ summary: 'Stream the original uploaded file' })
  async downloadFile(
    @CurrentBusiness() businessId: string,
    @Param('id') id: string,
    @Res() res: Response,
  ) {
    const row = await this.documentScansService.getRowOrFail(businessId, id);
    const path = join(row.storage_path);
    if (!(await storedFileExists(path))) {
      throw new EntityNotFoundException('Document scan file', id);
    }
    streamStoredFile(res, path, {
      'Content-Type': row.mime_type,
      'Content-Disposition': `inline; filename="${encodeURIComponent(row.original_file_name)}"`,
    });
  }

  @Patch(':id')
  @Permissions('document_scans.manage')
  @ApiOperation({
    summary: 'Update document scan metadata (not the file itself)',
  })
  update(
    @CurrentBusiness() businessId: string,
    @CurrentUser('userId') actorUserId: string,
    @Param('id') id: string,
    @Body() dto: UpdateDocumentScanDto,
  ) {
    return this.documentScansService.update(businessId, id, dto, actorUserId);
  }

  @Delete(':id')
  @Permissions('document_scans.manage')
  @HttpCode(HttpStatus.NO_CONTENT)
  @RawResponse()
  @ApiOperation({ summary: 'Soft delete a document scan and its file' })
  async remove(
    @CurrentBusiness() businessId: string,
    @CurrentUser('userId') actorUserId: string,
    @Param('id') id: string,
  ) {
    await this.documentScansService.softDelete(businessId, id, actorUserId);
  }
}
