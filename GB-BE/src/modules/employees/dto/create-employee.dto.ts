import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsBoolean,
  IsDateString,
  IsEmail,
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Min,
  MaxLength,
  MinLength,
} from 'class-validator';
import {
  EmployeeDocumentType,
  EmployeePayFrequency,
  EmployeeStatus,
} from '../domain/employee.types';

export class CreateEmployeeDto {
  @ApiProperty({ maxLength: 100 })
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  firstName: string;

  @ApiProperty({ maxLength: 100 })
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  lastName: string;

  @ApiPropertyOptional({ enum: EmployeeDocumentType })
  @IsOptional()
  @IsEnum(EmployeeDocumentType)
  documentType?: EmployeeDocumentType;

  @ApiPropertyOptional({ maxLength: 30, description: 'Unique within the business' })
  @IsOptional()
  @IsString()
  @MinLength(3)
  @MaxLength(30)
  documentNumber?: string;

  @ApiPropertyOptional({ maxLength: 30 })
  @IsOptional()
  @IsString()
  @MaxLength(30)
  phone?: string;

  @ApiPropertyOptional({ enum: EmployeeStatus, default: EmployeeStatus.ACTIVE })
  @IsOptional()
  @IsEnum(EmployeeStatus)
  status?: EmployeeStatus;

  @ApiPropertyOptional()
  @IsOptional()
  @IsEmail()
  @MaxLength(150)
  email?: string;

  @ApiPropertyOptional({ maxLength: 100 })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  position?: string;

  @ApiProperty({
    description:
      "System role granted to this employee — also used for the login account created automatically for them",
  })
  @IsUUID()
  roleId: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  branchId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  hireDate?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  notes?: string;

  @ApiPropertyOptional({
    minimum: 0,
    description: 'Pay rate ("valor") per shift/week/month, per payFrequency',
  })
  @IsOptional()
  @IsNumber()
  @Min(0)
  payRate?: number;

  @ApiPropertyOptional({ enum: EmployeePayFrequency })
  @IsOptional()
  @IsEnum(EmployeePayFrequency)
  payFrequency?: EmployeePayFrequency;

  @ApiPropertyOptional({
    default: true,
    description:
      'False registers the employee without a login account; one can be generated later',
  })
  @IsOptional()
  @IsBoolean()
  createAccess?: boolean;
}
