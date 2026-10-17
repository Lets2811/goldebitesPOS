import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsEmail,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  Min,
  ValidateIf,
  ValidateNested,
} from 'class-validator';
import { BUYER_DOCUMENT_CODES } from '../domain/e-invoice.types';

export class EInvoicingSettingsDto {
  @ApiProperty({ enum: ['SANDBOX', 'PRODUCTION'] })
  @IsIn(['SANDBOX', 'PRODUCTION'])
  environment: 'SANDBOX' | 'PRODUCTION';

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  clientId: string;

  @ApiPropertyOptional({ description: 'Leave out to keep the saved one' })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  clientSecret?: string;

  @ApiProperty({ description: 'The Factus account e-mail' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(150)
  username: string;

  @ApiPropertyOptional({ description: 'Leave out to keep the saved one' })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  password?: string;

  @ApiPropertyOptional({ description: 'Factus numbering range for invoices' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  numberingRangeId?: number | null;

  @ApiProperty({
    enum: ['04', '01'],
    description: '04 INC (impuesto al consumo) or 01 IVA',
  })
  @IsIn(['04', '01'])
  taxCode: '04' | '01';
}

export class EInvoiceBuyerDto {
  @ApiProperty({ enum: ['FINAL_CONSUMER', 'IDENTIFIED'] })
  @IsIn(['FINAL_CONSUMER', 'IDENTIFIED'])
  kind: 'FINAL_CONSUMER' | 'IDENTIFIED';

  @ApiPropertyOptional({
    enum: BUYER_DOCUMENT_CODES,
    description: '13 CC, 31 NIT, 22 CE, 41 pasaporte, 48 PPT…',
  })
  @ValidateIf((buyer: EInvoiceBuyerDto) => buyer.kind === 'IDENTIFIED')
  @IsIn([...BUYER_DOCUMENT_CODES])
  documentCode?: (typeof BUYER_DOCUMENT_CODES)[number];

  @ApiPropertyOptional()
  @ValidateIf((buyer: EInvoiceBuyerDto) => buyer.kind === 'IDENTIFIED')
  @IsString()
  @Matches(/^[0-9A-Za-z.\- ]{3,20}$/, {
    message: 'identification must be a document number',
  })
  identification?: string;

  @ApiPropertyOptional({
    description: 'NIT check digit; computed by the provider if left out',
  })
  @IsOptional()
  @Matches(/^\d$/)
  dv?: string;

  @ApiPropertyOptional({ enum: ['NATURAL', 'JURIDICA'] })
  @ValidateIf((buyer: EInvoiceBuyerDto) => buyer.kind === 'IDENTIFIED')
  @IsIn(['NATURAL', 'JURIDICA'])
  legalOrganization?: 'NATURAL' | 'JURIDICA';

  @ApiPropertyOptional({ description: 'Person or company name' })
  @ValidateIf((buyer: EInvoiceBuyerDto) => buyer.kind === 'IDENTIFIED')
  @IsString()
  @IsNotEmpty()
  @MaxLength(150)
  name?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsEmail()
  @MaxLength(150)
  email?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(30)
  phone?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(200)
  address?: string;
}

export class IssueEInvoiceDto {
  @ApiProperty({ type: EInvoiceBuyerDto })
  @ValidateNested()
  @Type(() => EInvoiceBuyerDto)
  buyer: EInvoiceBuyerDto;
}
