import { Body, Controller, Get, Param, Patch, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentBusiness } from '../../../common/decorators/current-business.decorator';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';
import { Permissions } from '../../../common/decorators/permissions.decorator';
import { CreatePaymentDto } from '../dto/create-payment.dto';
import { UpdatePaymentMethodDto } from '../dto/update-payment-method.dto';
import { PaymentsService } from '../services/payments.service';
import { BranchOperation } from '../../../common/decorators/branch-operation.decorator';

@ApiTags('Payments')
@ApiBearerAuth()
@BranchOperation()
@Controller('orders/:orderId/payments')
export class PaymentsController {
  constructor(private readonly paymentsService: PaymentsService) {}

  @Post()
  @Permissions('orders.update')
  @ApiOperation({ summary: 'Register a payment against an order' })
  create(
    @CurrentBusiness() businessId: string,
    @CurrentUser('userId') actorUserId: string,
    @Param('orderId') orderId: string,
    @Body() dto: CreatePaymentDto,
  ) {
    return this.paymentsService.create(
      businessId,
      { orderId, ...dto },
      actorUserId,
    );
  }

  @Get()
  @Permissions('orders.read')
  @ApiOperation({ summary: 'List payments registered for an order' })
  findAll(
    @CurrentBusiness() businessId: string,
    @Param('orderId') orderId: string,
  ) {
    return this.paymentsService.findByOrder(businessId, orderId);
  }

  @Patch(':paymentId')
  @Permissions('orders.update')
  @ApiOperation({
    summary:
      'Correct a payment\'s method (e.g. it was marked "transferencia" but was actually cash)',
  })
  updateMethod(
    @CurrentBusiness() businessId: string,
    @CurrentUser('userId') actorUserId: string,
    @Param('orderId') orderId: string,
    @Param('paymentId') paymentId: string,
    @Body() dto: UpdatePaymentMethodDto,
  ) {
    return this.paymentsService.updateMethod(
      businessId,
      orderId,
      paymentId,
      dto,
      actorUserId,
    );
  }
}
