export interface LlmMessage {
  role: "system" | "user";
  text: string;
}

export type LlmEffort = "low" | "medium" | "high" | "xhigh" | "max";

export interface LlmOptions {
  model?: string;
  maxTokens?: number;
  effort?: LlmEffort;
}

export interface LlmUsage {
  inputTokens: number;
  outputTokens: number;
}

export interface CompleteResult {
  text: string;
  /** Модель, которая фактически ответила (может отличаться при server-side fallback) */
  model: string;
  usage: LlmUsage;
  /** Claude отказался отвечать (stop_reason === "refusal") */
  refused: boolean;
}

export class LlmError extends Error {
  constructor(
    message: string,
    public statusCode?: number
  ) {
    super(message);
    this.name = "LlmError";
  }
}
