import { ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { UnauthorizedOperationException } from '../exceptions';
import { AuthenticatedUser } from '../interfaces/authenticated-user.interface';
import { RolesGuard } from './roles.guard';

function createContext(user?: AuthenticatedUser): ExecutionContext {
  return {
    getHandler: () => ({}),
    getClass: () => ({}),
    switchToHttp: () => ({ getRequest: () => ({ user }) }),
  } as unknown as ExecutionContext;
}

function createUser(
  overrides: Partial<AuthenticatedUser> = {},
): AuthenticatedUser {
  return {
    userId: 'u1',
    businessId: 'b1',
    branchId: null,
    roleId: 'r1',
    roleName: 'CASHIER',
    permissions: [],
    enabledFeatures: [],
    mustChangePassword: false,
    ...overrides,
  };
}

describe('RolesGuard', () => {
  it('allows the request when no @Roles() metadata is set', () => {
    const reflector = {
      getAllAndOverride: jest.fn().mockReturnValue(undefined),
    } as unknown as Reflector;
    const guard = new RolesGuard(reflector);

    expect(guard.canActivate(createContext(createUser()))).toBe(true);
  });

  it('allows the request when the user role matches', () => {
    const reflector = {
      getAllAndOverride: jest.fn().mockReturnValue(['OWNER', 'SUPER_ADMIN']),
    } as unknown as Reflector;
    const guard = new RolesGuard(reflector);

    expect(
      guard.canActivate(createContext(createUser({ roleName: 'OWNER' }))),
    ).toBe(true);
  });

  it('rejects when the user role does not match', () => {
    const reflector = {
      getAllAndOverride: jest.fn().mockReturnValue(['SUPER_ADMIN']),
    } as unknown as Reflector;
    const guard = new RolesGuard(reflector);

    expect(() =>
      guard.canActivate(createContext(createUser({ roleName: 'CASHIER' }))),
    ).toThrow(UnauthorizedOperationException);
  });

  it('rejects when there is no authenticated user', () => {
    const reflector = {
      getAllAndOverride: jest.fn().mockReturnValue(['SUPER_ADMIN']),
    } as unknown as Reflector;
    const guard = new RolesGuard(reflector);

    expect(() => guard.canActivate(createContext(undefined))).toThrow(
      UnauthorizedOperationException,
    );
  });
});
