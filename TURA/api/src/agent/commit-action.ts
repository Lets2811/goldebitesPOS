import type { Session } from '../auth.js';
import { PosApiError } from '../pos/pos-client.js';
import { toolsFor } from '../tools/registry.js';
import { ToolRefusedError, type AssistantTool, type PendingAction } from '../tools/types.js';

/** What came of making a confirmed change: the words for the user, and for the audit log what failed. */
export type CommitOutcome =
  | { ok: true; message: string }
  | { ok: false; message: string; failure: string; status: number };

/**
 * Makes a change the user confirmed — by voice, in writing or with the
 * button — as that user, with exactly the input it was prepared with, and
 * only while they still have the permission it needs.
 */
export async function commitAction(
  action: PendingAction,
  session: Session,
  tools: AssistantTool[] = toolsFor(session),
): Promise<CommitOutcome> {
  const tool = tools.find((candidate) => candidate.definition.name === action.tool);
  if (!tool || tool.kind !== 'write') {
    const message = 'Tu usuario ya no tiene permiso para hacer este cambio.';
    return { ok: false, message, failure: message, status: 403 };
  }
  try {
    const { message } = await tool.commit(action.input, { session });
    return { ok: true, message };
  } catch (error) {
    if (error instanceof ToolRefusedError) {
      return { ok: false, message: `No hice el cambio: ${error.message}`, failure: error.message, status: 409 };
    }
    if (error instanceof PosApiError) {
      return {
        ok: false,
        message: `El POS no hizo el cambio: ${error.message}`,
        failure: `POS ${error.status}: ${error.message}`,
        status: error.status >= 500 ? 502 : 422,
      };
    }
    console.error('Confirmed action failed', error);
    return {
      ok: false,
      message: 'Ocurrió un error al hacer el cambio. Intenta de nuevo.',
      failure: error instanceof Error ? `${error.name}: ${error.message}` : String(error),
      status: 500,
    };
  }
}
