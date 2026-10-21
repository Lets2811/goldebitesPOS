import { randomUUID } from 'node:crypto';
import type { PendingAction, PendingActionStore } from '../tools/types.js';

/** How long a prepared change waits for the user's confirmation. */
export const PENDING_ACTION_TTL_MS = 10 * 60 * 1000;

/**
 * Prepared changes waiting for the user, in this process's memory. TURA/api
 * runs as a single instance, and a pending change is short-lived and cheap to
 * lose: after a restart the user is simply asked again. An action is handed
 * over once, only to the user it was prepared for, and only before it
 * expires.
 */
export class MemoryPendingActionStore implements PendingActionStore {
  private readonly actions = new Map<string, PendingAction>();
  private readonly turns = new Map<string, number>();

  constructor(
    private readonly ttlMs = PENDING_ACTION_TTL_MS,
    private readonly now: () => number = Date.now,
  ) {}

  async create(action: Omit<PendingAction, 'id' | 'createdAt'>): Promise<PendingAction> {
    this.sweep();
    const created: PendingAction = {
      ...action,
      id: randomUUID(),
      createdAt: new Date(this.now()).toISOString(),
    };
    this.actions.set(created.id, created);
    return created;
  }

  async take(id: string, userId: string): Promise<PendingAction | null> {
    const action = this.actions.get(id);
    if (!action || action.userId !== userId) {
      return null;
    }
    this.actions.delete(id);
    return Date.parse(action.expiresAt) > this.now() ? action : null;
  }

  async discard(id: string, userId: string): Promise<void> {
    if (this.actions.get(id)?.userId === userId) {
      this.actions.delete(id);
    }
  }

  async beginTurn(userId: string): Promise<number> {
    const turn = (this.turns.get(userId) ?? 0) + 1;
    this.turns.set(userId, turn);
    return turn;
  }

  async takeFromTurn(userId: string, turn: number): Promise<PendingAction[]> {
    this.sweep();
    const taken: PendingAction[] = [];
    for (const [id, action] of this.actions) {
      if (action.userId === userId && action.turn === turn) {
        this.actions.delete(id);
        taken.push(action);
      }
    }
    return taken;
  }

  /** When it would expire, if prepared now. */
  expiry(): string {
    return new Date(this.now() + this.ttlMs).toISOString();
  }

  private sweep(): void {
    const now = this.now();
    for (const [id, action] of this.actions) {
      if (Date.parse(action.expiresAt) <= now) {
        this.actions.delete(id);
      }
    }
  }
}

/** The store the service uses. */
export const pendingActions = new MemoryPendingActionStore();
