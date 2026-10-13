import type { Session } from '../auth.js';
import { consultarProductos } from './consultar-productos.js';
import type { AssistantTool } from './types.js';

/**
 * Every tool the assistant has. Adding one is a new file next to this one and
 * a line here. The order is part of what the model's prompt cache is keyed
 * on, so new tools go at the end.
 */
const TOOLS: AssistantTool[] = [consultarProductos];

/**
 * The tools offered in one conversation. Those the user has no permission
 * for are left out, so the assistant never promises something the POS would
 * refuse; the POS still checks every call.
 */
export function toolsFor(session: Session, tools: AssistantTool[] = TOOLS): AssistantTool[] {
  return tools.filter((tool) => session.permissions.includes(tool.permission));
}
