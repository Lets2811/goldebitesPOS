import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Put,
  Res,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import { CurrentBusiness } from '../../../common/decorators/current-business.decorator';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';
import { Permissions } from '../../../common/decorators/permissions.decorator';
import { RawResponse } from '../../../common/decorators/raw-response.decorator';
import { InternalActor, InternalRoute } from '../../../internal/internal-api';
import { RequiresFeature } from '../../../common/decorators/requires-feature.decorator';
import { EInvoiceBuyer } from '../domain/e-invoice.types';
import {
  EInvoiceBuyerDto,
  EInvoicingSettingsDto,
  IssueEInvoiceDto,
} from '../dto/e-invoicing.dto';
import { EInvoicingService } from '../services/e-invoicing.service';
import { BranchOperation } from '../../../common/decorators/branch-operation.decorator';

function toBuyer(dto: EInvoiceBuyerDto): EInvoiceBuyer {
  if (dto.kind === 'FINAL_CONSUMER') return { kind: 'FINAL_CONSUMER' };
  return {
    kind: 'IDENTIFIED',
    documentCode: dto.documentCode!,
    identification: dto.identification!,
    dv: dto.dv,
    legalOrganization: dto.legalOrganization!,
    name: dto.name!.trim(),
    email: dto.email || undefined,
    phone: dto.phone || undefined,
    address: dto.address || undefined,
  };
}

/** A business issuing electronic invoices for its paid orders (the "einvoicing" add-on). */
@ApiTags('Electronic invoicing')
@ApiBearerAuth()
@RequiresFeature('einvoicing')
@BranchOperation()
@Controller()
export class EInvoicesController {
  constructor(private readonly eInvoicingService: EInvoicingService) {}

  @Get('e-invoicing/status')
  @ApiOperation({
    summary:
      'Whether this business can issue electronic invoices (connected to its provider)',
  })
  status(@CurrentBusiness() businessId: string) {
    return this.eInvoicingService.status(businessId);
  }

  @Get('orders/:orderId/e-invoice')
  @Permissions('orders.read')
  @ApiOperation({ summary: "The order's electronic invoice, or null" })
  findForOrder(
    @CurrentBusiness() businessId: string,
    @Param('orderId', ParseUUIDPipe) orderId: string,
  ) {
    return this.eInvoicingService.findForOrder(businessId, orderId);
  }

  @Post('orders/:orderId/e-invoice')
  @Permissions('einvoices.issue')
  @ApiOperation({
    summary: 'Issue the electronic invoice (DIAN) of a paid order; idempotent',
  })
  issue(
    @CurrentBusiness() businessId: string,
    @CurrentUser('userId') actorUserId: string,
    @Param('orderId', ParseUUIDPipe) orderId: string,
    @Body() dto: IssueEInvoiceDto,
  ) {
    return this.eInvoicingService.issue(
      businessId,
      orderId,
      toBuyer(dto.buyer),
      actorUserId,
    );
  }

  @Get('e-invoices/:id/pdf')
  @Permissions('orders.read')
  @RawResponse()
  @ApiOperation({
    summary: "The electronic invoice's PDF (its legal graphic representation)",
  })
  async pdf(
    @CurrentBusiness() businessId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Res() res: Response,
  ) {
    const { fileName, pdf } = await this.eInvoicingService.downloadPdf(
      businessId,
      id,
    );
    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `inline; filename="${fileName.replace(/[^\w.-]/g, '_')}.pdf"`,
      'Cache-Control': 'private, max-age=300',
    });
    res.send(pdf);
  }
}

/** The platform admin connecting a business to its own Factus account. */
@ApiTags('Platform Admin')
@ApiBearerAuth()
@InternalRoute()
@Controller('internal/businesses/:businessId/e-invoicing')
export class PlatformEInvoicingController {
  constructor(private readonly eInvoicingService: EInvoicingService) {}

  @Get()
  @ApiOperation({
    summary: "A business's electronic-invoicing connection (never the secrets)",
  })
  get(@Param('businessId', ParseUUIDPipe) businessId: string) {
    return this.eInvoicingService.getSettings(businessId);
  }

  @Put()
  @ApiOperation({
    summary:
      "Save a business's Factus credentials (encrypted), numbering range and tax",
  })
  save(
    @Param('businessId', ParseUUIDPipe) businessId: string,
    @InternalActor() actorUserId: string,
    @Body() dto: EInvoicingSettingsDto,
  ) {
    return this.eInvoicingService.saveSettings(businessId, dto, actorUserId);
  }

  @Post('test')
  @ApiOperation({
    summary:
      'Log in to Factus with these (or the saved) credentials and list the invoice ranges',
  })
  test(
    @Param('businessId', ParseUUIDPipe) businessId: string,
    @Body() dto: EInvoicingSettingsDto,
  ) {
    return this.eInvoicingService.testConnection(businessId, dto);
  }
}
