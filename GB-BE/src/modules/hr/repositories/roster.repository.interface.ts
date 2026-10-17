import { RosterShiftRow } from '../domain/roster.types';

export interface IRosterRepository {
  /** Every weekly shift of the business's employees that aren't deleted or inactive. */
  findShifts(businessId: string): Promise<RosterShiftRow[]>;
}

export const ROSTER_REPOSITORY = Symbol('ROSTER_REPOSITORY');
