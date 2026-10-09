import { Module } from '@nestjs/common';
import { AuditModule } from '../audit/audit.module';
import { BranchesModule } from '../branches/branches.module';
import { TableNamesModule } from '../table-names/table-names.module';
import { NfcTagsController } from './controllers/nfc-tags.controller';
import { PublicNfcController } from './controllers/public-nfc.controller';
import { TableHelpRequestsController } from './controllers/table-help-requests.controller';
import { NfcTagsRepository } from './repositories/nfc-tags.repository';
import { NFC_TAGS_REPOSITORY } from './repositories/nfc-tags.repository.interface';
import { TableHelpRequestsRepository } from './repositories/table-help-requests.repository';
import { TABLE_HELP_REQUESTS_REPOSITORY } from './repositories/table-help-requests.repository.interface';
import { NfcTagsService } from './services/nfc-tags.service';
import { TableHelpRequestsService } from './services/table-help-requests.service';

@Module({
  imports: [AuditModule, BranchesModule, TableNamesModule],
  controllers: [NfcTagsController, PublicNfcController, TableHelpRequestsController],
  providers: [
    NfcTagsService,
    { provide: NFC_TAGS_REPOSITORY, useClass: NfcTagsRepository },
    TableHelpRequestsService,
    { provide: TABLE_HELP_REQUESTS_REPOSITORY, useClass: TableHelpRequestsRepository },
  ],
  exports: [NfcTagsService],
})
export class NfcTagsModule {}
