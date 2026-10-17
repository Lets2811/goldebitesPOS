import { BusinessRuleException, CashSessionClosedException } from '../../../common/exceptions';
import { CashSession, CashSessionStatus } from '../../cash-sessions/domain/cash-session.interface';
import { CashSessionsService } from '../../cash-sessions/services/cash-sessions.service';

/**
 * The open cash session money goes into (an income) or comes out of (an
 * expense): the one named explicitly, or the only one open in the branch.
 * With several open and none named, the caller has to choose (AC-03) — the
 * error lists the candidates so the client can ask.
 */
export async function resolveOpenCashSession(
  cashSessionsService: CashSessionsService,
  businessId: string,
  branchId: string | undefined,
  explicitCashSessionId: string | undefined,
): Promise<CashSession> {
  if (explicitCashSessionId) {
    const session = await cashSessionsService.findOne(businessId, explicitCashSessionId);
    if (session.status !== CashSessionStatus.OPEN) {
      throw new CashSessionClosedException(explicitCashSessionId);
    }
    return session;
  }

  const openSessions = await cashSessionsService.findAllOpen(businessId, branchId);
  if (openSessions.length === 0) {
    throw new BusinessRuleException('No open cash session available', 'NO_OPEN_CASH_SESSION');
  }
  if (openSessions.length > 1) {
    throw new BusinessRuleException(
      'Multiple open cash sessions — specify which one the money belongs to',
      'CASH_SESSION_SELECTION_REQUIRED',
      { candidates: openSessions.map((session) => ({ cashSessionId: session.id, branchId: session.branchId })) },
    );
  }
  return openSessions[0];
}
