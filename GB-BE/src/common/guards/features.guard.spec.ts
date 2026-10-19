import { ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { UnauthorizedOperationException } from '../exceptions';
import { AuthenticatedUser } from '../interfaces/authenticated-user.interface';
import { FeaturesGuard } from './features.guard';

function createContext(user?: AuthenticatedUser): ExecutionContext {
  return {
    getHandler: () => ({}),
    getClass: () => ({}),
    switchToHttp: () => ({ getRequest: () => ({ user }) }),
  } as unknown as ExecutionContext;
}

function createUser(enabledFeatures: string[]): AuthenticatedUser {
  return {
    userId: 'u1',
    businessId: 'b1',
    branchId: null,
    roleId: 'r1',
    roleName: 'CASHIER',
    permissions: [],
    enabledFeatures,
    mustChangePassword: false,
  };
}

describe('FeaturesGuard', () => {
  it('allows the request when no @RequiresFeature() metadata is set', () => {
    const reflector = {
      getAllAndOverride: jest.fn().mockReturnValue(undefined),
    } as unknown as Reflector;
    const guard = new FeaturesGuard(reflector);

    expect(guard.canActivate(createContext(createUser([])))).toBe(true);
  });

  it('allows the request when the user has the required module feature', () => {
    const reflector = {
      getAllAndOverride: jest.fn().mockReturnValue('inventory'),
    } as unknown as Reflector;
    const guard = new FeaturesGuard(reflector);

    expect(guard.canActivate(createContext(createUser(['inventory'])))).toBe(
      true,
    );
  });

  it('allows the request when the user has the required sub-feature, alongside its parent module', () => {
    const reflector = {
      getAllAndOverride: jest
        .fn()
        .mockReturnValue('inventory.specializedQueries'),
    } as unknown as Reflector;
    const guard = new FeaturesGuard(reflector);

    expect(
      guard.canActivate(
        createContext(
          createUser(['inventory', 'inventory.specializedQueries']),
        ),
      ),
    ).toBe(true);
  });

  it('rejects when the user has the parent module but not the specific sub-feature', () => {
    const reflector = {
      getAllAndOverride: jest
        .fn()
        .mockReturnValue('inventory.specializedQueries'),
    } as unknown as Reflector;
    const guard = new FeaturesGuard(reflector);

    expect(() =>
      guard.canActivate(createContext(createUser(['inventory']))),
    ).toThrow(UnauthorizedOperationException);
  });

  it('rejects when the business does not have the required feature enabled', () => {
    const reflector = {
      getAllAndOverride: jest.fn().mockReturnValue('inventory'),
    } as unknown as Reflector;
    const guard = new FeaturesGuard(reflector);

    expect(() =>
      guard.canActivate(createContext(createUser(['orders']))),
    ).toThrow(UnauthorizedOperationException);
  });

  it('rejects when there is no authenticated user', () => {
    const reflector = {
      getAllAndOverride: jest.fn().mockReturnValue('inventory'),
    } as unknown as Reflector;
    const guard = new FeaturesGuard(reflector);

    expect(() => guard.canActivate(createContext(undefined))).toThrow(
      UnauthorizedOperationException,
    );
  });

  it('rejects (rather than throwing a TypeError) when the token predates the enabledFeatures claim', () => {
    const reflector = {
      getAllAndOverride: jest.fn().mockReturnValue('inventory'),
    } as unknown as Reflector;
    const guard = new FeaturesGuard(reflector);
    const staleUser = {
      ...createUser([]),
      enabledFeatures: undefined,
    } as unknown as AuthenticatedUser;

    expect(() => guard.canActivate(createContext(staleUser))).toThrow(
      UnauthorizedOperationException,
    );
  });
});
