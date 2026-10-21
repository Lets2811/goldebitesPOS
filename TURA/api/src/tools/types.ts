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
 * A tool that changes something in the POS. It runs when the model calls it,
 * as the user who asked: `run` checks the change can be made (the item
 * exists, is theirs, is not already so), makes it, and says how it was left.
 * The POS still authorizes the call.
 */
export interface WriteToolSpec<Schema extends z.ZodType> extends ToolSpec<Schema> {
  /** Makes the change. `branchId` is the branch it happened at, for the answer. */
  run(input: z.infer<Schema>, context: ToolContext): Promise<{ message: string; branchId?: string }>;
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
  run(input: unknown, context: ToolContext): Promise<{ message: string; branchId?: string }>;
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

/** Declares a write tool: the model's call makes the change. */
export function defineWriteTool<Schema extends z.ZodType>(spec: WriteToolSpec<Schema>): WriteAssistantTool {
  return {
    ...describeTool(spec),
    kind: 'write',
    run: (input, context) => spec.run(input as z.infer<Schema>, context),
  };
}
