import { Module } from '@nestjs/common';
import { AuditModule } from '../audit/audit.module';
import { DiscountsController } from './discounts.controller';
import { DiscountsRepository } from './discounts.repository';
import { DiscountsService } from './discounts.service';

@Module({
  imports: [AuditModule],
  controllers: [DiscountsController],
  providers: [DiscountsService, DiscountsRepository],
  exports: [DiscountsService, DiscountsRepository],
})
export class DiscountsModule {}
