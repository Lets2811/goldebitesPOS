import { Module } from '@nestjs/common';
import { AuditModule } from '../audit/audit.module';
import { OrdersModule } from '../orders/orders.module';
import { PaymentsModule } from '../payments/payments.module';
import {
  EInvoicesController,
  PlatformEInvoicingController,
} from './controllers/e-invoices.controller';
import { FactusClient } from './factus/factus.client';
import { EInvoicingRepository } from './repositories/e-invoicing.repository';
import { EInvoicingService } from './services/e-invoicing.service';

@Module({
  imports: [OrdersModule, PaymentsModule, AuditModule],
  controllers: [EInvoicesController, PlatformEInvoicingController],
  providers: [EInvoicingService, EInvoicingRepository, FactusClient],
})
export class EInvoicingModule {}
