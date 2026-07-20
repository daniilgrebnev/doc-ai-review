import { describe, expect, it } from "vitest";
import { computeVerdict, getVerdictLabel } from "@/lib/pipeline/verdict";
import type { AgentResult } from "@/types/agent";

describe("computeVerdict", () => {
  it("returns approved when all approved", () => {
    const results: AgentResult[] = [
      { agentId: "lawyer", status: "approved", comment: "" },
      { agentId: "finance", status: "approved", comment: "" },
    ];
    expect(computeVerdict(results)).toBe("approved");
  });

  it("returns rejected when any rejected", () => {
    const results: AgentResult[] = [
      { agentId: "lawyer", status: "approved", comment: "" },
      { agentId: "finance", status: "rejected", comment: "" },
    ];
    expect(computeVerdict(results)).toBe("rejected");
  });

  it("returns revision when any revision and no rejected", () => {
    const results: AgentResult[] = [
      { agentId: "lawyer", status: "approved", comment: "" },
      { agentId: "finance", status: "revision", comment: "" },
    ];
    expect(computeVerdict(results)).toBe("revision");
  });

  it("treats error as rejected", () => {
    const results: AgentResult[] = [
      { agentId: "lawyer", status: "error", comment: "", error: "fail" },
    ];
    expect(computeVerdict(results)).toBe("rejected");
  });
});

describe("getVerdictLabel", () => {
  it("returns Russian labels", () => {
    expect(getVerdictLabel("approved")).toBe("Документ согласован");
    expect(getVerdictLabel("rejected")).toBe("Документ отклонён");
    expect(getVerdictLabel("revision")).toBe("Требуется доработка");
  });
});
