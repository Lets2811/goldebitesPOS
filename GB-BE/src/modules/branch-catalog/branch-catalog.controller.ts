import { Body, Controller, Param, Post } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiProperty,
  ApiTags,
} from '@nestjs/swagger';
import { IsUUID } from 'class-validator';
import { CurrentBusiness } from '../../common/decorators/current-business.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Permissions } from '../../common/decorators/permissions.decorator';
import { RequiresFeature } from '../../common/decorators/requires-feature.decorator';
import { BranchCatalogService } from './branch-catalog.service';

export class CopyToBranchDto {
  @ApiProperty({ description: 'The branch that gets its own copy' })
  @IsUUID()
  branchId: string;
}

@ApiTags('Products')
@ApiBearerAuth()
@RequiresFeature('products')
@Controller('products')
export class BranchCatalogController {
  constructor(private readonly service: BranchCatalogService) {}

  @Post(':id/copy-to-branch')
  @Permissions('products.create')
  @ApiOperation({
    summary:
      'Bring a product to another branch: an independent copy there, recipe included',
  })
  copyToBranch(
    @CurrentBusiness() businessId: string,
    @CurrentUser('userId') actorUserId: string,
    @Param('id') id: string,
    @Body() dto: CopyToBranchDto,
  ) {
    return this.service.copyProductToBranch(
      businessId,
      id,
      dto.branchId,
      actorUserId,
    );
  }
}
