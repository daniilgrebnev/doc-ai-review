const JSON_SCHEMA = `{
  "status": "approved" | "rejected" | "revision",
  "comment": "2-4 предложения на русском",
  "issues": ["конкретное замечание 1", "замечание 2"]
}`;

const EXAMPLE = `Пример:
Документ: "Договор без указания срока оплаты..."
Ответ: {"status":"revision","comment":"Отсутствует срок оплаты и порядок расчётов.","issues":["Не указан срок оплаты","Нет условий неустойки"]}`;

import { CORPORATE_TASK_CONTEXT } from "@/lib/agents/prompts/context";

export const PROMPT_FOOTER = `
${CORPORATE_TASK_CONTEXT}

Верни ТОЛЬКО JSON без markdown-обёртки:
${JSON_SCHEMA}

Если раздел документа не относится к твоей компетенции — status: "approved", comment: "Вне зоны ответственности", issues: []

${EXAMPLE}`;
