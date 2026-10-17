import { Body, Controller, Get, Param, Patch, Post, Put } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentBusiness } from '../../../common/decorators/current-business.decorator';
import { Permissions } from '../../../common/decorators/permissions.decorator';
import { RequiresFeature } from '../../../common/decorators/requires-feature.decorator';
import { CreateRoleDto } from '../dto/create-role.dto';
import { SetRolePermissionsDto } from '../dto/set-role-permissions.dto';
import { UpdateRoleDto } from '../dto/update-role.dto';
import { RolesService } from '../services/roles.service';

@ApiTags('Roles')
@ApiBearerAuth()
@RequiresFeature('roles')
@Controller('roles')
export class RolesController {
  constructor(private readonly rolesService: RolesService) {}

  @Post()
  @Permissions('roles.manage')
  @ApiOperation({ summary: 'Create a custom role for the current business' })
  create(@CurrentBusiness() businessId: string, @Body() dto: CreateRoleDto) {
    const { permissionCodes, ...role } = dto;
    return this.rolesService.create({ businessId, ...role }, permissionCodes);
  }

  @Get()
  @Permissions('roles.manage')
  @ApiOperation({ summary: 'List roles for the current business' })
  findAll(@CurrentBusiness() businessId: string) {
    return this.rolesService.findAllForBusiness(businessId);
  }

  @Get(':id')
  @Permissions('roles.manage')
  @ApiOperation({ summary: 'Get a role with its assigned permissions' })
  findOne(@CurrentBusiness() businessId: string, @Param('id') id: string) {
    return this.rolesService.findOne(businessId, id);
  }

  @Patch(':id')
  @Permissions('roles.manage')
  @ApiOperation({ summary: 'Update a role name/description' })
  update(
    @CurrentBusiness() businessId: string,
    @Param('id') id: string,
    @Body() dto: UpdateRoleDto,
  ) {
    return this.rolesService.update(businessId, id, dto);
  }

  @Put(':id/permissions')
  @Permissions('roles.manage')
  @ApiOperation({
    summary: 'Replace the full set of permissions granted to a role',
  })
  setPermissions(
    @CurrentBusiness() businessId: string,
    @Param('id') id: string,
    @Body() dto: SetRolePermissionsDto,
  ) {
    return this.rolesService.setPermissions(
      businessId,
      id,
      dto.permissionCodes,
    );
  }
}
