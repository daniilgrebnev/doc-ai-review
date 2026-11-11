/**
 * Цены моделей в USD за 1M токенов (input / output).
 * Claude — прайс Anthropic на ноябрь 2026, DeepSeek — прайс platform.deepseek.com.
 * YandexGPT тарифицируется в рублях, поэтому стоимость не считаем (null).
 */
interface Price {
  input: number;
  output: number;
}

const PRICES: Array<[prefix: string, price: Price]> = [
  ["claude-haiku-5-5", { input: 0.1, output: 0.5 }],
  ["claude-sonnet-5-5", { input: 2, output: 10 }],
  ["claude-opus-5-5", { input: 4, output: 20 }],
  ["claude-fable-5-2", { input: 8, output: 40 }],
  // deepseek-chat сейчас отвечает моделью deepseek-flash (V4 Flash); цена за cache miss
  ["deepseek-flash", { input: 0.14, output: 0.28 }],
  ["deepseek-v4-flash", { input: 0.14, output: 0.28 }],
  ["deepseek-chat", { input: 0.14, output: 0.28 }],
  ["deepseek-pro", { input: 0.435, output: 0.87 }],
  ["deepseek-v4-pro", { input: 0.435, output: 0.87 }],
  ["deepseek-reasoner", { input: 0.435, output: 0.87 }],
];

export function getModelPrice(model: string): Price | null {
  const id = model.trim().toLowerCase();
  return PRICES.find(([prefix]) => id.startsWith(prefix))?.[1] ?? null;
}

/** Стоимость запроса в USD, null если цена модели неизвестна */
export function computeCostUsd(model: string, inputTokens: number, outputTokens: number): number | null {
  const price = getModelPrice(model);
  if (!price) return null;
  const cost = (inputTokens * price.input + outputTokens * price.output) / 1_000_000;
  return Math.round(cost * 1e6) / 1e6;
}
