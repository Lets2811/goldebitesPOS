import { Controller, Get, Param, Post } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Public } from '../../../common/decorators/public.decorator';
import { NfcTagsService } from '../services/nfc-tags.service';
import { TableHelpRequestsService } from '../services/table-help-requests.service';

/**
 * Resolves a scanned gallo's public token to its business/branch/table — the
 * only thing a customer's NFC tap needs. No @Permissions()/@Roles(): there is
 * no request.user on a public request, and the token itself is explicitly
 * not treated as authentication (nothing here identifies the customer).
 */
@ApiTags('Public NFC')
@Public()
@Controller('public/nfc')
export class PublicNfcController {
  constructor(
    private readonly nfcTagsService: NfcTagsService,
    private readonly helpRequestsService: TableHelpRequestsService,
  ) {}

  @Get(':token')
  @ApiOperation({ summary: 'Resolve an NFC tag\'s token to its business/branch/table context' })
  resolve(@Param('token') token: string) {
    return this.nfcTagsService.resolvePublic(token);
  }

  @Post(':token/help')
  @ApiOperation({ summary: 'The table asks for staff — raises an alert on the orders screen until someone attends it' })
  requestHelp(@Param('token') token: string) {
    return this.helpRequestsService.requestFromToken(token);
  }
}
