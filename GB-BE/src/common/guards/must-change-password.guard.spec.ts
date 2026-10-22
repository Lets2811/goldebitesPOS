import { ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { DomainException } from '../exceptions';
import { AuthenticatedUser } from '../interfaces/authenticated-user.interface';
import { MustChangePasswordGuard } from './must-change-password.guard';

function createContext(user?: AuthenticatedUser): ExecutionContext {
  return {
    getHandler: () => ({}),
    getClass: () => ({}),
    switchToHttp: () => ({ getRequest: () => ({ user }) }),
  } as unknown as ExecutionContext;
}

function createUser(mustChangePassword: boolean): AuthenticatedUser {
  return {
    userId: 'u1',
    businessId: 'b1',
    branchId: null,
    roleId: 'r1',
    roleName: 'CASHIER',
    permissions: [],
    enabledFeatures: [],
    mustChangePassword,
  };
}

describe('MustChangePasswordGuard', () => {
  it('allows the request when the user has no pending password change', () => {
    const reflector = {
      getAllAndOverride: jest.fn().mockReturnValue(undefined),
    };
    const guard = new MustChangePasswordGuard(
      reflector as unknown as Reflector,
    );

    expect(guard.canActivate(createContext(createUser(false)))).toBe(true);
  });

  it('blocks the request with PASSWORD_CHANGE_REQUIRED when the flag is set and the route is not exempt', () => {
    const reflector = {
      getAllAndOverride: jest.fn().mockReturnValue(undefined),
    };
    const guard = new MustChangePasswordGuard(
      reflector as unknown as Reflector,
    );

    let thrown: unknown;
    try {
      guard.canActivate(createContext(createUser(true)));
    } catch (error) {
      thrown = error;
    }

    expect(thrown).toBeInstanceOf(DomainException);
    expect((thrown as DomainException).code).toBe('PASSWORD_CHANGE_REQUIRED');
  });

  it('allows the request when @SkipMustChangePassword() marks the route, even with the flag set', () => {
    const reflector = { getAllAndOverride: jest.fn().mockReturnValue(true) };
    const guard = new MustChangePasswordGuard(
      reflector as unknown as Reflector,
    );

    expect(guard.canActivate(createContext(createUser(true)))).toBe(true);
  });

  it('allows the request when there is no authenticated user at all (public routes)', () => {
    const reflector = {
      getAllAndOverride: jest.fn().mockReturnValue(undefined),
    };
    const guard = new MustChangePasswordGuard(
      reflector as unknown as Reflector,
    );

    expect(guard.canActivate(createContext(undefined))).toBe(true);
  });
});
