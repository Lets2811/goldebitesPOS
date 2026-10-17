import {
  BadRequestException,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  Res,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBearerAuth, ApiConsumes, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import { randomUUID } from 'node:crypto';
import { extname } from 'node:path';
import { diskStorage } from 'multer';
import { CurrentBusiness } from '../../../common/decorators/current-business.decorator';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';
import { Permissions } from '../../../common/decorators/permissions.decorator';
import { RawResponse } from '../../../common/decorators/raw-response.decorator';
import { RequiresFeature } from '../../../common/decorators/requires-feature.decorator';
import { EntityNotFoundException } from '../../../common/exceptions';
import { storedFileExists, streamStoredFile } from '../../../common/utils/stream-file.util';
import { ExpenseAttachmentsService } from '../services/expense-attachments.service';
import {
  EXPENSE_ATTACHMENTS_UPLOADS_DIR,
  EXPENSE_ATTACHMENT_MAX_BYTES,
  EXPENSE_ATTACHMENT_MIME_TYPES,
  ensureExpenseAttachmentsUploadsDir,
} from '../storage/expense-attachment-storage.util';

ensureExpenseAttachmentsUploadsDir();

@ApiTags('Finances')
@ApiBearerAuth()
@RequiresFeature('finances')
@Controller('expenses/:expenseId/attachments')
export class ExpenseAttachmentsController {
  constructor(private readonly attachmentsService: ExpenseAttachmentsService) {}

  @Post()
  @Permissions('finances.manage')
  @ApiConsumes('multipart/form-data')
  @ApiOperation({ summary: 'Attach a receipt (invoice, ticket photo, voucher) to an expense or purchase' })
  @UseInterceptors(
    FileInterceptor('file', {
      storage: diskStorage({
        destination: EXPENSE_ATTACHMENTS_UPLOADS_DIR,
        filename: (_req, file, cb) => cb(null, `${randomUUID()}${extname(file.originalname)}`),
      }),
      limits: { fileSize: EXPENSE_ATTACHMENT_MAX_BYTES },
      fileFilter: (_req, file, cb) => {
        if (!EXPENSE_ATTACHMENT_MIME_TYPES.includes(file.mimetype)) {
          cb(new BadRequestException('Solo se permiten archivos PDF o imágenes (JPG, PNG, WEBP).'), false);
          return;
        }
        cb(null, true);
      },
    }),
  )
  add(
    @CurrentBusiness() businessId: string,
    @CurrentUser('userId') userId: string,
    @Param('expenseId', ParseUUIDPipe) expenseId: string,
    @UploadedFile() file: Express.Multer.File,
  ) {
    if (!file) {
      throw new BadRequestException('Debes adjuntar un archivo (PDF o imagen).');
    }
    return this.attachmentsService.add(
      businessId,
      expenseId,
      { originalName: file.originalname, path: file.path, mimeType: file.mimetype, size: file.size },
      userId,
    );
  }

  @Get()
  @Permissions('finances.read')
  @ApiOperation({ summary: "List an expense's receipts" })
  list(@CurrentBusiness() businessId: string, @Param('expenseId', ParseUUIDPipe) expenseId: string) {
    return this.attachmentsService.list(businessId, expenseId);
  }

  @Get(':id/file')
  @Permissions('finances.read')
  @RawResponse()
  @ApiOperation({ summary: 'Stream the uploaded receipt' })
  async download(
    @CurrentBusiness() businessId: string,
    @Param('expenseId', ParseUUIDPipe) expenseId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Res() res: Response,
  ) {
    const row = await this.attachmentsService.getForDownload(businessId, expenseId, id);
    if (!(await storedFileExists(row.storage_path))) {
      throw new EntityNotFoundException('Expense attachment file', id);
    }
    streamStoredFile(res, row.storage_path, {
      'Content-Type': row.mime_type,
      'Content-Disposition': `inline; filename="${encodeURIComponent(row.original_file_name)}"`,
    });
  }

  @Delete(':id')
  @Permissions('finances.manage')
  @HttpCode(HttpStatus.NO_CONTENT)
  @RawResponse()
  @ApiOperation({ summary: 'Remove a receipt and its file' })
  async remove(
    @CurrentBusiness() businessId: string,
    @CurrentUser('userId') userId: string,
    @Param('expenseId', ParseUUIDPipe) expenseId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    await this.attachmentsService.remove(businessId, expenseId, id, userId);
  }
}
