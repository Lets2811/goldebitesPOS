import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Public } from '../../../common/decorators/public.decorator';
import { AppConfig } from '../../../config/app.config';
import { OrderType } from '../../orders/domain/order.interface';
import { OrdersService } from '../../orders/services/orders.service';
import { PaymentsService } from '../../payments/services/payments.service';
import { ProductCategoriesService } from '../../product-categories/services/product-categories.service';
import { ProductsService } from '../../products/services/products.service';
import { BranchMenuService } from '../../products/services/branch-menu.service';
import { CreateCarServiceOrderDto } from '../dto/create-car-service-order.dto';
import { CreateCarServicePaymentDto } from '../dto/create-car-service-payment.dto';

/**
 * Endpoints for the unattended Car Service kiosk. Every route here is
 * @Public() (no employee session) and none carry @Permissions()/@Roles() —
 * doing so would fail every request, since there is no request.user to read
 * them from. businessId/branchId are fixed from server config, never from
 * the client, since there is no JWT to derive them from.
 */
@ApiTags('Tablet Kiosk (public)')
@Public()
@Controller('public/car-service')
export class TabletKioskController {
  constructor(
    private readonly configService: ConfigService,
    private readonly ordersService: OrdersService,
    private readonly productsService: ProductsService,
    private readonly productCategoriesService: ProductCategoriesService,
    private readonly paymentsService: PaymentsService,
    private readonly branchMenuService: BranchMenuService,
  ) {}

  private get businessId(): string {
    return this.configService.getOrThrow<AppConfig>('app').carService
      .businessId;
  }

  private get branchId(): string {
    return this.configService.getOrThrow<AppConfig>('app').carService.branchId;
  }

  @Get('product-categories')
  @ApiOperation({ summary: 'Active product categories for the kiosk' })
  getProductCategories() {
    return this.productCategoriesService.findAll({
      businessId: this.businessId,
      isActive: true,
      page: 1,
      limit: 100,
    });
  }

  @Get('products')
  @ApiOperation({ summary: 'Active products for the kiosk' })
  async getProducts(@Query('categoryId') categoryId?: string) {
    const [result, branchMenu] = await Promise.all([
      this.productsService.findAll({
        businessId: this.businessId,
        branchId: this.branchId,
        isActive: true,
        categoryId,
        page: 1,
        limit: 100,
      }),
      this.branchMenuService.forBranch(this.businessId, this.branchId),
    ]);
    // The kiosk's branch catalog, without what ran out.
    const data = result.data.filter(
      (product) => !branchMenu.get(product.id)?.outOfStock,
    );
    return { ...result, data };
  }

  @Post('orders')
  @ApiOperation({
    summary: 'Create and auto-confirm a Car Service order',
  })
  async createOrder(@Body() dto: CreateCarServiceOrderDto) {
    const order = await this.ordersService.create(
      {
        businessId: this.businessId,
        branchId: this.branchId,
        orderType: OrderType.CAR_SERVICE,
        tableNumber: dto.tableNumber,
      },
      dto.items,
    );
    return this.ordersService.tryAutoConfirm(this.businessId, order.id);
  }

  @Get('orders/active')
  @ApiOperation({ summary: 'Active Car Service orders (for kiosk polling)' })
  getActiveOrders() {
    return this.ordersService.findAll({
      businessId: this.businessId,
      orderType: OrderType.CAR_SERVICE,
      page: 1,
      limit: 50,
    });
  }

  @Post('orders/:id/payments')
  @ApiOperation({ summary: 'Register a payment for a Car Service order' })
  async createPayment(
    @Param('id') orderId: string,
    @Body() dto: CreateCarServicePaymentDto,
  ) {
    const order = await this.ordersService.findOne(this.businessId, orderId);
    if (order.orderType !== OrderType.CAR_SERVICE) {
      throw new BadRequestException('Order is not a Car Service order');
    }
    return this.paymentsService.create(this.businessId, {
      orderId,
      ...dto,
    });
  }
}
