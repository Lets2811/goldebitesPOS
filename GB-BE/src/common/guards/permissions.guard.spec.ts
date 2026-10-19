import { ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { UnauthorizedOperationException } from '../exceptions';
import { AuthenticatedUser } from '../interfaces/authenticated-user.interface';
import { PermissionsGuard } from './permissions.guard';

function createContext(user?: AuthenticatedUser): ExecutionContext {
  return {
    getHandler: () => ({}),
    getClass: () => ({}),
    switchToHttp: () => ({ getRequest: () => ({ user }) }),
  } as unknown as ExecutionContext;
}

function createUser(permissions: string[]): AuthenticatedUser {
  return {
    userId: 'u1',
    businessId: 'b1',
    branchId: null,
    roleId: 'r1',
    roleName: 'CASHIER',
    permissions,
    enabledFeatures: [],
    mustChangePassword: false,
  };
}

describe('PermissionsGuard', () => {
  it('allows the request when no @Permissions() metadata is set', () => {
    const reflector = {
      getAllAndOverride: jest.fn().mockReturnValue(undefined),
    } as unknown as Reflector;
    const guard = new PermissionsGuard(reflector);

    expect(guard.canActivate(createContext(createUser([])))).toBe(true);
  });

  it('allows the request when the user has every required permission', () => {
    const reflector = {
      getAllAndOverride: jest
        .fn()
        .mockReturnValue(['orders.read', 'orders.create']),
    } as unknown as Reflector;
    const guard = new PermissionsGuard(reflector);

    expect(
      guard.canActivate(
        createContext(
          createUser(['orders.read', 'orders.create', 'orders.update']),
        ),
      ),
    ).toBe(true);
  });

  it('rejects when the user is missing at least one required permission', () => {
    const reflector = {
      getAllAndOverride: jest
        .fn()
        .mockReturnValue(['orders.read', 'orders.cancel']),
    } as unknown as Reflector;
    const guard = new PermissionsGuard(reflector);

    expect(() =>
      guard.canActivate(createContext(createUser(['orders.read']))),
    ).toThrow(UnauthorizedOperationException);
  });

  it('rejects when there is no authenticated user', () => {
    const reflector = {
      getAllAndOverride: jest.fn().mockReturnValue(['orders.read']),
    } as unknown as Reflector;
    const guard = new PermissionsGuard(reflector);

    expect(() => guard.canActivate(createContext(undefined))).toThrow(
      UnauthorizedOperationException,
    );
  });
});
