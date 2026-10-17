import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsDateString,
  IsEnum,
  IsIn,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  MaxLength,
} from 'class-validator';
import { LeaveRequestStatus, LeaveRequestType } from '../domain/leave-request.types';

const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;

/** What an employee fills in to ask for time off. */
export class CreateLeaveRequestDto {
  @ApiProperty({ enum: LeaveRequestType })
  @IsEnum(LeaveRequestType)
  type: LeaveRequestType;

  @ApiProperty({ example: '2026-10-20' })
  @IsDateString()
  @Matches(DATE_ONLY)
  startDate: string;

  @ApiProperty({ example: '2026-10-21', description: 'Last day off, included' })
  @IsDateString()
  @Matches(DATE_ONLY)
  endDate: string;

  @ApiPropertyOptional({ maxLength: 1000 })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  reason?: string;
}

/** An administrator registering time off for an employee directly — it's approved from the start. */
export class CreateEmployeeLeaveDto extends CreateLeaveRequestDto {
  @ApiProperty()
  @IsUUID()
  employeeId: string;
}

export class ReviewLeaveRequestDto {
  @ApiProperty({ enum: [LeaveRequestStatus.APPROVED, LeaveRequestStatus.REJECTED] })
  @IsIn([LeaveRequestStatus.APPROVED, LeaveRequestStatus.REJECTED])
  decision: LeaveRequestStatus.APPROVED | LeaveRequestStatus.REJECTED;

  @ApiPropertyOptional({ maxLength: 500 })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  note?: string;
}

export class LeaveRequestQueryDto {
  @ApiPropertyOptional({ enum: LeaveRequestStatus })
  @IsOptional()
  @IsEnum(LeaveRequestStatus)
  status?: LeaveRequestStatus;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  employeeId?: string;
}
