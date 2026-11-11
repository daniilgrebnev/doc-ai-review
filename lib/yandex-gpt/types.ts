export interface YGptMessage {
  role: "system" | "user" | "assistant";
  text: string;
}

export interface YGptOptions {
  model?: string;
  temperature?: number;
  maxTokens?: number;
}

export interface YGptUsage {
  inputTextTokens: string;
  completionTokens: string;
  totalTokens: string;
}

export interface YGptCompletionResponse {
  result: {
    alternatives: Array<{
      message: {
        role: string;
        text: string;
      };
      status: string;
    }>;
    usage: YGptUsage;
    modelVersion: string;
  };
}

export class YandexGptError extends Error {
  constructor(
    message: string,
    public statusCode?: number
  ) {
    super(message);
    this.name = "YandexGptError";
  }
}
