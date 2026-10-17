import { OmitType, PartialType } from '@nestjs/swagger';
import { CreateEmployeeDto } from './create-employee.dto';

/** Login access is managed through the credentials endpoints, not here. */
export class UpdateEmployeeDto extends PartialType(
  OmitType(CreateEmployeeDto, ['createAccess'] as const),
) {}
