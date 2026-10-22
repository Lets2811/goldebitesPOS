import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsDateString,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import {
  BILLING_MODES,
  type BillingMode,
  DISTANCE_UNITS,
  type DistanceUnit,
} from '../domain/delivery-pricing';
import {
  DELIVERY_STATUSES,
  type DeliveryStatus,
} from '../domain/delivery.interface';

const MONEY_MAX = 100_000_000;

export class DeliverySettingsDto {
  @ApiProperty({ example: 0, description: 'Optional base fee; 0 for none' })
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(MONEY_MAX)
  baseFee: number;

  @ApiProperty({ example: 1000 })
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(MONEY_MAX)
  pricePerUnit: number;

  @ApiProperty({ enum: DISTANCE_UNITS, example: 'KM' })
  @IsIn(DISTANCE_UNITS)
  unit: DistanceUnit;

  @ApiProperty({ example: 1, description: 'How much distance one unit is' })
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.01)
  @Max(100_000)
  unitSize: number;

  @ApiProperty({ enum: BILLING_MODES, example: 'PROPORTIONAL' })
  @IsIn(BILLING_MODES)
  billingMode: BillingMode;

  @ApiProperty({ example: 0 })
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(MONEY_MAX)
  minimumFee: number;

  @ApiProperty({
    example: 100,
    description: 'Round up to a multiple; 0 for none',
  })
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(1_000_000)
  roundingStep: number;
}

export class LatLngDto {
  @ApiProperty({ example: 6.2442 })
  @IsNumber()
  @Min(-90)
  @Max(90)
  latitude: number;

  @ApiProperty({ example: -75.5812 })
  @IsNumber()
  @Min(-180)
  @Max(180)
  longitude: number;
}

export class DestinationDto extends LatLngDto {
  @ApiProperty({ example: 'Cra. 43A #1-50, Medellín' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(500)
  address: string;

  @ApiPropertyOptional({ example: 'Apto 502, torre 2' })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  details?: string | null;
}

export class CreateDeliveryDto {
  @ApiProperty()
  @IsUUID()
  branchId: string;

  @ApiPropertyOptional({ description: 'Order of the POS this delivery is for' })
  @IsOptional()
  @IsUUID()
  orderId?: string | null;

  @ApiPropertyOptional({ description: 'A user with the courier role' })
  @IsOptional()
  @IsUUID()
  courierUserId?: string | null;

  @ApiProperty({ type: LatLngDto })
  @ValidateNested()
  @Type(() => LatLngDto)
  origin: LatLngDto;

  @ApiProperty({ type: DestinationDto })
  @ValidateNested()
  @Type(() => DestinationDto)
  destination: DestinationDto;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(150)
  customerName?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(30)
  customerPhone?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  notes?: string | null;

  @ApiProperty({ example: 3400, description: 'Route distance by road' })
  @IsInt()
  @Min(0)
  @Max(1_000_000)
  distanceMeters: number;

  @ApiPropertyOptional({ example: 720 })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(1_000_000)
  durationSeconds?: number | null;
}

export class AssignCourierDto {
  @ApiProperty({ nullable: true, description: 'Null to unassign' })
  @IsOptional()
  @IsUUID()
  courierUserId: string | null;
}

export class ChangeDeliveryStatusDto {
  @ApiProperty({ enum: DELIVERY_STATUSES })
  @IsIn(DELIVERY_STATUSES)
  status: DeliveryStatus;
}

export class DeliveryQueryDto {
  @ApiPropertyOptional({ enum: DELIVERY_STATUSES })
  @IsOptional()
  @IsIn(DELIVERY_STATUSES)
  status?: DeliveryStatus;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  branchId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  courierUserId?: string;

  @ApiPropertyOptional({ example: '2026-10-19T00:00:00-05:00' })
  @IsOptional()
  @IsDateString()
  from?: string;

  @ApiPropertyOptional({ example: '2026-10-19T23:59:59-05:00' })
  @IsOptional()
  @IsDateString()
  to?: string;
}

export class LinkableOrdersQueryDto {
  @ApiPropertyOptional({ description: 'Order number, address or customer' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  search?: string;
}

export class CourierDeliveriesQueryDto {
  @ApiProperty({ enum: ['active', 'pending', 'history'] })
  @IsIn(['active', 'pending', 'history'])
  scope: 'active' | 'pending' | 'history';

  @ApiPropertyOptional({ description: 'Only since then (history)' })
  @IsOptional()
  @IsDateString()
  from?: string;
}

export class CourierBalanceQueryDto {
  @ApiProperty({
    description: "Start of the period, e.g. the device's midnight",
  })
  @IsDateString()
  from: string;
}

export class AdvanceOwnDeliveryDto {
  @ApiProperty({ enum: ['IN_TRANSIT', 'DELIVERED'] })
  @IsIn(['IN_TRANSIT', 'DELIVERED'])
  status: 'IN_TRANSIT' | 'DELIVERED';
}

export class CourierPositionDto extends LatLngDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(100_000)
  accuracyMeters?: number | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(360)
  heading?: number | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(200)
  speedMps?: number | null;
}

export class MessagesQueryDto {
  @ApiPropertyOptional({ description: 'Only messages after this moment' })
  @IsOptional()
  @IsDateString()
  after?: string;
}

export class SendDeliveryMessageDto {
  @ApiProperty({ maxLength: 1000 })
  @IsString()
  @IsNotEmpty()
  @MaxLength(1000)
  body: string;
}

export class CallRestaurantDto {
  @ApiPropertyOptional({
    maxLength: 200,
    example: 'El pedido llegó incompleto',
  })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  reason?: string;
}

export class LinkOrderDto {
  @ApiProperty({ nullable: true, description: 'Null to unlink' })
  @IsOptional()
  @IsUUID()
  orderId: string | null;
}

export class ResolveLocationDto {
  @ApiProperty({
    example: 'https://maps.google.com/?q=6.2442,-75.5812',
    description:
      'What was shared: a WhatsApp location, a Maps/Waze link or coordinates',
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(2000)
  text: string;
}
