import type { AgentDefinition, AgentId } from "@/types/agent";

export const AGENTS: AgentDefinition[] = [
  {
    id: "lawyer",
    name: "Юрист",
    role: "Проверка юридических рисков",
    order: 1,
    iconName: "Scale",
  },
  {
    id: "finance",
    name: "Финансист",
    role: "Анализ финансовых условий",
    order: 2,
    iconName: "Wallet",
  },
  {
    id: "security",
    name: "СБ",
    role: "Информационная безопасность",
    order: 3,
    iconName: "Shield",
  },
  {
    id: "pm",
    name: "Руководитель проекта",
    role: "Соответствие целям проекта",
    order: 4,
    iconName: "Briefcase",
  },
];

export const AGENT_IDS = AGENTS.map((agent) => agent.id);

export function isValidAgentId(id: string): id is AgentId {
  return AGENT_IDS.includes(id as AgentId);
}

export function getAgentById(id: string): AgentDefinition | undefined {
  return AGENTS.find((agent) => agent.id === id);
}

export function getSortedAgents(): AgentDefinition[] {
  return [...AGENTS].sort((a, b) => a.order - b.order);
}
