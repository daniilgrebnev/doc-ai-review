import { Briefcase, Scale, Shield, Wallet, type LucideIcon } from "lucide-react";
import type { AgentDefinition } from "@/types/agent";

const ICON_MAP: Record<AgentDefinition["iconName"], LucideIcon> = {
  Scale,
  Wallet,
  Shield,
  Briefcase,
};

export function getAgentIcon(agent: AgentDefinition): LucideIcon {
  return ICON_MAP[agent.iconName];
}
