import { Controller, Get, Param, ParseUUIDPipe, Res } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import { Public } from '../../../common/decorators/public.decorator';
import { RawResponse } from '../../../common/decorators/raw-response.decorator';
import { EntityNotFoundException } from '../../../common/exceptions';
import {
  storedFileExists,
  streamStoredFile,
} from '../../../common/utils/stream-file.util';
import { ProductsService } from '../services/products.service';

/**
 * Product photos, without login: the customer menu shows them to anyone, and
 * the POS loads them with a plain <img>, which can't send a token. Product
 * ids are UUIDs, so a photo is only reachable through a menu that lists it.
 */
@ApiTags('Public Product Images')
@Public()
@Controller('public/product-images')
export class PublicProductImagesController {
  constructor(private readonly productsService: ProductsService) {}

  @Get(':id')
  @RawResponse()
  @ApiOperation({ summary: "Stream a product's uploaded photo" })
  async getImage(@Param('id', ParseUUIDPipe) id: string, @Res() res: Response) {
    const image = await this.productsService.getImageFile(id);
    if (!image || !(await storedFileExists(image.path))) {
      throw new EntityNotFoundException('Product image', id);
    }
    streamStoredFile(res, image.path, {
      'Content-Type': image.mimeType,
      // The URL carries ?v=<when it was uploaded>: a new photo is a new URL.
      'Cache-Control': 'public, max-age=31536000, immutable',
      // Shown by pages of other origins too: the phone apps run at
      // https://localhost (helmet's default allows only this site's own).
      'Cross-Origin-Resource-Policy': 'cross-origin',
    });
  }
}
