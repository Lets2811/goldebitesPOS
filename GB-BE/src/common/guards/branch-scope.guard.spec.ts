import { Controller, ExecutionContext, Get, Query } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { IsOptional, IsString, IsUUID } from 'class-validator';
import { BranchSelectionExempt } from '../decorators/branch-selection-exempt.decorator';
import { BranchOperation } from '../decorators/branch-operation.decorator';
import { DomainException } from '../exceptions';
import { AuthenticatedUser } from '../interfaces/authenticated-user.interface';
import { BranchScopeGuard } from './branch-scope.guard';

class FilteredQueryDto {
  @IsOptional()
  @IsUUID()
  branchId?: string;
}

class SearchQueryDto {
  @IsOptional()
  @IsString()
  search?: string;
}

@Controller('sample')
@BranchOperation()
class SampleController {
  @Get('filtered')
  filtered(@Query() _query: FilteredQueryDto) {}

  @Get('named')
  named(@Query('branchId') _branchId?: string) {}

  @Get('search')
  search(@Query() _query: SearchQueryDto) {}

  @Get('exempt')
  @BranchSelectionExempt()
  exempt() {}

  @Get('config')
  @BranchOperation(false)
  config() {}
}

type Handler = keyof SampleController;

interface FakeRequest {
  method?: string;
  user?: Partial<AuthenticatedUser>;
  query?: Record<string, unknown>;
  body?: unknown;
  params?: Record<string, unknown>;
}

function contextFor(handler: Handler, request: FakeRequest): ExecutionContext {
  return {
    getType: () => 'http',
    getHandler: () => SampleController.prototype[handler],
    getClass: () => SampleController,
    switchToHttp: () => ({ getRequest: () => request }),
  } as unknown as ExecutionContext;
}

const cashier = (overrides: Partial<AuthenticatedUser> = {}) => ({
  userId: 'user-1',
  branchId: 'branch-1',
  permissions: ['orders.read'],
  ...overrides,
});

describe('BranchScopeGuard', () => {
  let guard: BranchScopeGuard;

  beforeEach(() => {
    guard = new BranchScopeGuard(new Reflector());
  });

  it('lets public requests through', () => {
    expect(guard.canActivate(contextFor('filtered', {}))).toBe(true);
  });

  it("filters a list to the user's branch when no branch is sent", () => {
    const request: FakeRequest = { user: cashier(), query: { page: '1' } };
    guard.canActivate(contextFor('filtered', request));
    expect(request.query).toEqual({ page: '1', branchId: 'branch-1' });
  });

  it('filters a handler that reads branchId by name', () => {
    const request: FakeRequest = { user: cashier(), query: {} };
    guard.canActivate(contextFor('named', request));
    expect(request.query).toEqual({ branchId: 'branch-1' });
  });

  it('leaves the query alone where the handler takes no branch filter', () => {
    const request: FakeRequest = { user: cashier(), query: { search: 'x' } };
    guard.canActivate(contextFor('search', request));
    expect(request.query).toEqual({ search: 'x' });
  });

  it.each([
    ['query', { query: { branchId: 'branch-2' } }],
    ['body', { body: { branchId: 'branch-2' } }],
    ['path', { params: { branchId: 'branch-2' } }],
  ])('refuses another branch in the %s', (_where, parts) => {
    expect(() =>
      guard.canActivate(contextFor('filtered', { user: cashier(), ...parts })),
    ).toThrow(DomainException);
  });

  it("accepts the user's own branch", () => {
    const request: FakeRequest = {
      user: cashier(),
      query: { branchId: 'branch-1' },
      body: { branchId: 'branch-1' },
    };
    expect(guard.canActivate(contextFor('filtered', request))).toBe(true);
  });

  it('does not narrow who may work at every branch', () => {
    const request: FakeRequest = {
      user: cashier({ permissions: ['branches.switch'] }),
      query: { branchId: 'branch-2' },
    };
    expect(guard.canActivate(contextFor('filtered', request))).toBe(true);
    expect(request.query).toEqual({ branchId: 'branch-2' });
  });

  it('does not narrow a user with no branch', () => {
    const request: FakeRequest = {
      user: cashier({ branchId: null }),
      query: {},
    };
    expect(guard.canActivate(contextFor('filtered', request))).toBe(true);
    expect(request.query).toEqual({});
  });

  it('refuses everything but the exempt routes until a branch is picked', () => {
    const user = cashier({
      branchId: null,
      branchSelectionRequired: true,
      permissions: ['branches.switch'],
    });
    expect(() =>
      guard.canActivate(contextFor('filtered', { user, query: {} })),
    ).toThrow(DomainException);
    expect(guard.canActivate(contextFor('exempt', { user }))).toBe(true);
  });

  describe('"Todas las sedes" is for review', () => {
    const allBranches = cashier({
      branchId: null,
      permissions: ['branches.switch'],
    });

    it('reads a branch operation', () => {
      expect(
        guard.canActivate(
          contextFor('filtered', {
            method: 'GET',
            user: allBranches,
            query: {},
          }),
        ),
      ).toBe(true);
    });

    it('refuses to record one', () => {
      expect(() =>
        guard.canActivate(
          contextFor('filtered', {
            method: 'POST',
            user: allBranches,
            body: {},
          }),
        ),
      ).toThrow(DomainException);
    });

    it('records configuration', () => {
      expect(
        guard.canActivate(
          contextFor('config', { method: 'PUT', user: allBranches, body: {} }),
        ),
      ).toBe(true);
    });

    it('records at a branch picked', () => {
      expect(
        guard.canActivate(
          contextFor('filtered', {
            method: 'POST',
            user: { ...allBranches, branchId: 'branch-1' },
            body: {},
          }),
        ),
      ).toBe(true);
    });
  });
});
