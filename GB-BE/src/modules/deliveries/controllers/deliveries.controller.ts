import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Put,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentBusiness } from '../../../common/decorators/current-business.decorator';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';
import { Permissions } from '../../../common/decorators/permissions.decorator';
import { RawResponse } from '../../../common/decorators/raw-response.decorator';
import { RequiresFeature } from '../../../common/decorators/requires-feature.decorator';
import {
  ResolveLocationDto,
  LinkOrderDto,
  AdvanceOwnDeliveryDto,
  CallRestaurantDto,
  AssignCourierDto,
  CourierBalanceQueryDto,
  CourierDeliveriesQueryDto,
  CourierPositionDto,
  MessagesQueryDto,
  SendDeliveryMessageDto,
  ChangeDeliveryStatusDto,
  CreateDeliveryDto,
  DeliveryQueryDto,
  DeliverySettingsDto,
  LatLngDto,
  LinkableOrdersQueryDto,
} from '../dto/deliveries.dto';
import { DeliveriesService } from '../services/deliveries.service';
import { DeliveryLocationService } from '../services/delivery-location.service';
import { DeliveryTrackingService } from '../services/delivery-tracking.service';
import { BranchOperation } from '../../../common/decorators/branch-operation.decorator';

const DELIVERIES_FEATURE = 'deliveries';

@ApiTags('Deliveries')
@ApiBearerAuth()
@RequiresFeature(DELIVERIES_FEATURE)
@BranchOperation()
@Controller('deliveries')
export class DeliveriesController {
  constructor(
    private readonly deliveriesService: DeliveriesService,
    private readonly trackingService: DeliveryTrackingService,
    private readonly locationService: DeliveryLocationService,
  ) {}

  // Fixed paths are declared before ':id' so they are never read as an id.

  @Get('settings')
  @Permissions('deliveries.read')
  @ApiOperation({ summary: "The business's delivery pricing" })
  getSettings(@CurrentBusiness() businessId: string) {
    return this.deliveriesService.getSettings(businessId);
  }

  @Put('settings')
  @BranchOperation(false)
  @Permissions('deliveries.configure')
  @ApiOperation({
    summary:
      'Set the delivery pricing (base, price per unit, minimum, rounding)',
  })
  saveSettings(
    @CurrentBusiness() businessId: string,
    @CurrentUser('userId') actorUserId: string,
    @Body() dto: DeliverySettingsDto,
  ) {
    return this.deliveriesService.saveSettings(businessId, dto, actorUserId);
  }

  @Get('branch-locations')
  @Permissions('deliveries.read')
  @ApiOperation({ summary: 'Every branch and where it is on the map' })
  getBranchLocations(@CurrentBusiness() businessId: string) {
    return this.deliveriesService.getBranchLocations(businessId);
  }

  @Put('branch-locations/:branchId')
  @BranchOperation(false)
  @Permissions('deliveries.configure')
  @ApiOperation({
    summary: 'Place a branch on the map (the start of its deliveries)',
  })
  setBranchLocation(
    @CurrentBusiness() businessId: string,
    @CurrentUser('userId') actorUserId: string,
    @Param('branchId', ParseUUIDPipe) branchId: string,
    @Body() dto: LatLngDto,
  ) {
    return this.deliveriesService.setBranchLocation(
      businessId,
      branchId,
      dto,
      actorUserId,
    );
  }

  @Get('couriers')
  @Permissions('deliveries.read')
  @ApiOperation({ summary: 'Active users with the courier role' })
  getCouriers(@CurrentBusiness() businessId: string) {
    return this.deliveriesService.getCouriers(businessId);
  }

  @Get('linkable-orders')
  @Permissions('deliveries.manage')
  @ApiOperation({ summary: 'Recent orders a delivery can be linked to' })
  getLinkableOrders(
    @CurrentBusiness() businessId: string,
    @Query() query: LinkableOrdersQueryDto,
  ) {
    return this.deliveriesService.getLinkableOrders(businessId, query.search);
  }

  @Post('resolve-location')
  @BranchOperation(false)
  @Permissions('deliveries.manage')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary:
      'Read the point in a shared location (WhatsApp, Google Maps, Waze, coordinates)',
  })
  resolveLocation(@Body() dto: ResolveLocationDto) {
    return this.locationService.resolve(dto.text);
  }

  @Get('tracking')
  @Permissions('deliveries.read')
  @ApiOperation({
    summary:
      'Every courier, where they are, and their open deliveries with the path ridden',
  })
  getTracking(@CurrentBusiness() businessId: string) {
    return this.trackingService.getTracking(businessId);
  }

  @Get('help-requests')
  @Permissions('deliveries.read')
  @ApiOperation({
    summary:
      'Deliveries whose customer or courier called the restaurant, not attended yet',
  })
  getHelpRequests(@CurrentBusiness() businessId: string) {
    return this.trackingService.getPendingHelpRequests(businessId);
  }

  @Patch('help-requests/:id/attend')
  @Permissions('deliveries.read')
  @HttpCode(HttpStatus.NO_CONTENT)
  @RawResponse()
  @ApiOperation({ summary: 'Mark a call as attended: it stops sounding' })
  async attendHelpRequest(
    @CurrentBusiness() businessId: string,
    @CurrentUser('userId') userId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    await this.trackingService.attendHelpRequest(businessId, id, userId);
  }

  // ---- The courier app: only the caller's own deliveries ----

  @Get('mine')
  @Permissions('deliveries.deliver')
  @ApiOperation({
    summary: "The caller's deliveries: active, pending or history",
  })
  findMine(
    @CurrentBusiness() businessId: string,
    @CurrentUser('userId') userId: string,
    @Query() query: CourierDeliveriesQueryDto,
  ) {
    return this.deliveriesService.findMine(
      businessId,
      userId,
      query.scope,
      query.from ? new Date(query.from) : undefined,
    );
  }

  @Get('mine/balance')
  @Permissions('deliveries.deliver')
  @ApiOperation({ summary: 'What the caller delivered since a moment' })
  getBalance(
    @CurrentBusiness() businessId: string,
    @CurrentUser('userId') userId: string,
    @Query() query: CourierBalanceQueryDto,
  ) {
    return this.deliveriesService.getBalance(
      businessId,
      userId,
      new Date(query.from),
    );
  }

  @Post('mine/position')
  @Permissions('deliveries.deliver')
  @ApiOperation({ summary: "Report where the caller's phone is" })
  reportPosition(
    @CurrentBusiness() businessId: string,
    @CurrentUser('userId') userId: string,
    @Body() dto: CourierPositionDto,
  ) {
    return this.trackingService.reportPosition(businessId, userId, {
      latitude: dto.latitude,
      longitude: dto.longitude,
      accuracyMeters: dto.accuracyMeters ?? null,
      heading: dto.heading ?? null,
      speedMps: dto.speedMps ?? null,
    });
  }

  @Patch('mine/:id/status')
  @Permissions('deliveries.deliver')
  @ApiOperation({
    summary:
      'Start (on the way) or finish (delivered) one of the caller’s deliveries',
  })
  advanceOwn(
    @CurrentBusiness() businessId: string,
    @CurrentUser('userId') userId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: AdvanceOwnDeliveryDto,
  ) {
    return this.deliveriesService.advanceOwn(
      businessId,
      userId,
      id,
      dto.status,
    );
  }

  @Post('mine/:id/help')
  @Permissions('deliveries.deliver')
  @ApiOperation({
    summary: 'Call the restaurant about one of the own deliveries',
  })
  async callRestaurant(
    @CurrentBusiness() businessId: string,
    @CurrentUser('userId') userId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CallRestaurantDto,
  ) {
    await this.trackingService.callRestaurantAsCourier(
      businessId,
      userId,
      id,
      dto.reason,
    );
    return { called: true };
  }

  @Get('mine/calls')
  @Permissions('deliveries.deliver')
  @ApiOperation({
    summary:
      'Calls to the caller not marked seen yet (the app rings while there are any)',
  })
  getMyCalls(
    @CurrentBusiness() businessId: string,
    @CurrentUser('userId') userId: string,
  ) {
    return this.trackingService.getMyCalls(businessId, userId);
  }

  @Patch('mine/:id/calls/seen')
  @Permissions('deliveries.deliver')
  @HttpCode(HttpStatus.NO_CONTENT)
  @RawResponse()
  @ApiOperation({
    summary: 'Mark the calls about one of the own deliveries as seen',
  })
  async markCallsSeen(
    @CurrentBusiness() businessId: string,
    @CurrentUser('userId') userId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    await this.trackingService.markCallsSeen(businessId, userId, id);
  }

  @Get('mine/:id/messages')
  @Permissions('deliveries.deliver')
  @ApiOperation({ summary: "Chat of one of the caller's deliveries" })
  listOwnMessages(
    @CurrentBusiness() businessId: string,
    @CurrentUser('userId') userId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Query() query: MessagesQueryDto,
  ) {
    return this.trackingService.listMessagesAsCourier(
      businessId,
      userId,
      id,
      query.after ? new Date(query.after) : undefined,
    );
  }

  @Post('mine/:id/messages')
  @Permissions('deliveries.deliver')
  @ApiOperation({ summary: 'Write to the customer, as the courier' })
  sendOwnMessage(
    @CurrentBusiness() businessId: string,
    @CurrentUser('userId') userId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: SendDeliveryMessageDto,
  ) {
    return this.trackingService.sendAsCourier(businessId, userId, id, dto.body);
  }

  @Get()
  @Permissions('deliveries.read')
  @ApiOperation({ summary: 'Deliveries, newest first' })
  findAll(
    @CurrentBusiness() businessId: string,
    @Query() query: DeliveryQueryDto,
  ) {
    return this.deliveriesService.findAll(businessId, {
      status: query.status,
      branchId: query.branchId,
      courierUserId: query.courierUserId,
      from: query.from ? new Date(query.from) : undefined,
      to: query.to ? new Date(query.to) : undefined,
    });
  }

  @Get(':id')
  @Permissions('deliveries.read')
  @ApiOperation({ summary: 'One delivery' })
  findOne(
    @CurrentBusiness() businessId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.deliveriesService.findOne(businessId, id);
  }

  @Get(':id/messages')
  @Permissions('deliveries.read')
  @ApiOperation({ summary: 'Chat of a delivery' })
  listMessages(
    @CurrentBusiness() businessId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Query() query: MessagesQueryDto,
  ) {
    return this.trackingService.listMessagesAsStaff(
      businessId,
      id,
      query.after ? new Date(query.after) : undefined,
    );
  }

  @Post(':id/messages')
  @Permissions('deliveries.manage')
  @ApiOperation({ summary: 'Write in a delivery chat, as the business' })
  sendMessage(
    @CurrentBusiness() businessId: string,
    @CurrentUser('userId') userId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: SendDeliveryMessageDto,
  ) {
    return this.trackingService.sendAsStaff(businessId, userId, id, dto.body);
  }

  @Post()
  @Permissions('deliveries.manage')
  @ApiOperation({
    summary: 'Create a delivery; its fee is computed from the route distance',
  })
  create(
    @CurrentBusiness() businessId: string,
    @CurrentUser('userId') actorUserId: string,
    @Body() dto: CreateDeliveryDto,
  ) {
    return this.deliveriesService.create(businessId, dto, actorUserId);
  }

  @Post(':id/call-courier')
  @Permissions('deliveries.manage')
  @ApiOperation({
    summary:
      "Call the delivery's courier: their phone rings (push) and the app until seen",
  })
  callCourier(
    @CurrentBusiness() businessId: string,
    @CurrentUser('userId') userId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.trackingService.callCourierAsStaff(businessId, userId, id);
  }

  @Patch(':id/order')
  @Permissions('deliveries.manage')
  @ApiOperation({
    summary: 'Link the delivery to an order (or unlink it with null)',
  })
  linkOrder(
    @CurrentBusiness() businessId: string,
    @CurrentUser('userId') actorUserId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: LinkOrderDto,
  ) {
    return this.deliveriesService.linkOrder(
      businessId,
      id,
      dto.orderId ?? null,
      actorUserId,
    );
  }

  @Patch(':id/courier')
  @Permissions('deliveries.manage')
  @ApiOperation({ summary: 'Assign or unassign the courier' })
  assignCourier(
    @CurrentBusiness() businessId: string,
    @CurrentUser('userId') actorUserId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: AssignCourierDto,
  ) {
    return this.deliveriesService.assignCourier(
      businessId,
      id,
      dto.courierUserId ?? null,
      actorUserId,
    );
  }

  @Patch(':id/status')
  @Permissions('deliveries.manage')
  @ApiOperation({
    summary: 'Move a delivery along (in transit, delivered, cancelled)',
  })
  changeStatus(
    @CurrentBusiness() businessId: string,
    @CurrentUser('userId') actorUserId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ChangeDeliveryStatusDto,
  ) {
    return this.deliveriesService.changeStatus(
      businessId,
      id,
      dto.status,
      actorUserId,
    );
  }
}
