import type Anthropic from '@anthropic-ai/sdk';
import { z } from 'zod';
import type { Session } from '../auth.js';

/**
 * What a tool runs with. Who is asking, their branch and their POS access all
 * come from here — from the session — and never from the model: a tool's
 * input only carries what the user actually asked for.
 */
export interface ToolContext {
  session: Session;
}

interface ToolSpec<Schema extends z.ZodType> {
  /** The name the model calls it by. */
  name: string;
  /** When to use it and what comes back, written for the model. */
  description: string;
  /** The POS permission the endpoint asks for. A user without it is not offered the tool. */
  permission: string;
  /** The parameters, validated before `execute` runs. */
  input: Schema;
}

/**
 * A tool that reads from the POS. One tool is one endpoint: `execute`
 * validates nothing (that is already done), calls the endpoint through
 * `context.session.pos`, and returns what the model should see — trimmed to
 * what is worth its tokens. A POS error is simply thrown: the agent turns it
 * into an error result the model can explain.
 */
export interface ReadToolSpec<Schema extends z.ZodType> extends ToolSpec<Schema> {
  execute(input: z.infer<Schema>, context: ToolContext): Promise<unknown>;
}

/**
 * A tool that changes something in the POS.
 *
 * A write is never executed by the model's call. The call only *prepares* it:
 * `prepare` checks it can be done and returns a summary in plain words, the
 * agent stores it as a PendingAction and shows the user what is about to
 * happen, with a button to confirm. `commit` runs only once the user confirms
 * that exact action (POST /tura/actions/:id/confirm), with the input it was
 * prepared with — never re-read from the model.
 */
export interface WriteToolSpec<Schema extends z.ZodType> extends ToolSpec<Schema> {
  /** Validates against the POS that the action is possible and describes it for the user. Changes nothing. */
  prepare(input: z.infer<Schema>, context: ToolContext): Promise<{ summary: string }>;
  /**
   * Performs the action. Called only for a confirmed PendingAction, with the
   * input it was prepared with. Returns what to tell the user it did.
   */
  commit(input: z.infer<Schema>, context: ToolContext): Promise<{ message: string }>;
}

/** A write the model asked for, waiting for the user to confirm it. */
export interface PendingAction {
  id: string;
  tool: string;
  /** What will happen, in the words shown to the user. */
  summary: string;
  /** The validated input `commit` will receive. Never re-read from the model. */
  input: unknown;
  /** The user who must confirm it; nobody else can. */
  userId: string;
  /**
   * The user's turn it was prepared in (see PendingActionStore.beginTurn).
   * Confirmed in conversation only in the next one: the user has to have
   * answered after hearing it.
   */
  turn: number;
  createdAt: string;
  /** After this it can no longer be confirmed. */
  expiresAt: string;
}

/** Where pending actions live between the model's call and the user's answer. */
export interface PendingActionStore {
  create(action: Omit<PendingAction, 'id' | 'createdAt'>): Promise<PendingAction>;
  /** Hands the action over exactly once, and only to its own user while it has not expired. */
  take(id: string, userId: string): Promise<PendingAction | null>;
  discard(id: string, userId: string): Promise<void>;
  /** Starts a new turn of the user's conversation and returns its number. */
  beginTurn(userId: string): Promise<number>;
  /** Hands over, once, the user's unexpired actions prepared in `turn`. */
  takeFromTurn(userId: string, turn: number): Promise<PendingAction[]>;
}

/**
 * Thrown by a tool that will not run what it was asked — a range too long,
 * say. Its message goes to the model as the tool's error, so it is written
 * for the user: what was wrong and what to ask for instead.
 */
export class ToolRefusedError extends Error {}

interface AssistantToolBase {
  permission: string;
  definition: Anthropic.Tool;
  /** Parses the model's input; the error message is safe to return to the model. */
  parse(input: unknown): { ok: true; value: unknown } | { ok: false; error: string };
}

export type ReadAssistantTool = AssistantToolBase & {
  kind: 'read';
  /** Runs the read. */
  execute(input: unknown, context: ToolContext): Promise<unknown>;
};

export type WriteAssistantTool = AssistantToolBase & {
  kind: 'write';
  prepare(input: unknown, context: ToolContext): Promise<{ summary: string }>;
  commit(input: unknown, context: ToolContext): Promise<{ message: string }>;
};

/** A tool as the agent holds it: its definition for the model, plus how to run it. */
export type AssistantTool = ReadAssistantTool | WriteAssistantTool;

function describeIssues(error: z.ZodError): string {
  return error.issues
    .map((issue) => `${issue.path.join('.') || 'input'}: ${issue.message}`)
    .join('; ');
}

/** What the model is told about a tool, and how its input is checked: both from the same schema. */
function describeTool<Schema extends z.ZodType>(spec: ToolSpec<Schema>): AssistantToolBase {
  return {
    permission: spec.permission,
    definition: {
      name: spec.name,
      description: spec.description,
      input_schema: z.toJSONSchema(spec.input, {
        target: 'draft-2020-12',
      }) as Anthropic.Tool.InputSchema,
    },
    parse(input) {
      const parsed = spec.input.safeParse(input);
      return parsed.success
        ? { ok: true, value: parsed.data }
        : { ok: false, error: describeIssues(parsed.error) };
    },
  };
}

/** Declares a read tool. The input schema the model sees is derived from the same schema that validates it. */
export function defineReadTool<Schema extends z.ZodType>(spec: ReadToolSpec<Schema>): ReadAssistantTool {
  return {
    ...describeTool(spec),
    kind: 'read',
    execute: (input, context) => spec.execute(input as z.infer<Schema>, context),
  };
}

/** Declares a write tool: the model's call prepares it, the user's confirmation commits it. */
export function defineWriteTool<Schema extends z.ZodType>(spec: WriteToolSpec<Schema>): WriteAssistantTool {
  return {
    ...describeTool(spec),
    kind: 'write',
    prepare: (input, context) => spec.prepare(input as z.infer<Schema>, context),
    commit: (input, context) => spec.commit(input as z.infer<Schema>, context),
  };
}
