import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import {
  IsDateString,
  IsEnum,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  MaxLength,
  MinLength,
  ValidateIf,
} from 'class-validator';
import { HrTaskPriority, HrTaskStatus } from '../domain/hr-task.types';

const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;

export class CreateHrTaskDto {
  @ApiProperty({ maxLength: 150 })
  @IsString()
  @MinLength(1)
  @MaxLength(150)
  title: string;

  @ApiPropertyOptional({ maxLength: 4000, nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(4000)
  description?: string | null;

  @ApiPropertyOptional({ nullable: true, description: 'Employee responsible for the task' })
  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @IsUUID()
  assigneeEmployeeId?: string | null;

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @IsUUID()
  branchId?: string | null;

  @ApiPropertyOptional({ enum: HrTaskPriority, default: HrTaskPriority.MEDIUM })
  @IsOptional()
  @IsEnum(HrTaskPriority)
  priority?: HrTaskPriority;

  @ApiPropertyOptional({ enum: HrTaskStatus, default: HrTaskStatus.TODO })
  @IsOptional()
  @IsEnum(HrTaskStatus)
  status?: HrTaskStatus;

  @ApiPropertyOptional({ example: '2026-10-31', nullable: true })
  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @IsDateString()
  @Matches(DATE_ONLY)
  dueDate?: string | null;
}

/** Null clears a field (assignee, branch, description, due date). */
export class UpdateHrTaskDto extends PartialType(CreateHrTaskDto) {}

export class SetHrTaskStatusDto {
  @ApiProperty({ enum: HrTaskStatus })
  @IsEnum(HrTaskStatus)
  status: HrTaskStatus;
}

export class HrTaskQueryDto {
  @ApiPropertyOptional({ enum: HrTaskStatus })
  @IsOptional()
  @IsEnum(HrTaskStatus)
  status?: HrTaskStatus;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  assigneeEmployeeId?: string;

  @ApiPropertyOptional({ description: 'Tasks of this branch plus the ones for every branch' })
  @IsOptional()
  @IsUUID()
  branchId?: string;
}
