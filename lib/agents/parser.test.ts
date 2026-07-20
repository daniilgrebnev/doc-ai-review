import { describe, expect, it } from "vitest";
import { parseAgentResponse } from "@/lib/agents/parser";

describe("parseAgentResponse", () => {
  it("parses valid JSON", () => {
    const raw = '{"status":"approved","comment":"Всё в порядке","issues":[]}';
    const result = parseAgentResponse("lawyer", raw);
    expect(result.status).toBe("approved");
    expect(result.comment).toBe("Всё в порядке");
  });

  it("parses markdown-wrapped JSON", () => {
    const raw = '```json\n{"status":"revision","comment":"Нужна доработка","issues":["Нет срока"]}\n```';
    const result = parseAgentResponse("lawyer", raw);
    expect(result.status).toBe("revision");
    expect(result.issues).toEqual(["Нет срока"]);
    expect(result.comment).toContain("Нужна доработка");
    expect(result.comment).toContain("• Нет срока");
  });

  it("normalizes Russian status", () => {
    const raw = '{"status":"согласовано","comment":"OK","issues":[]}';
    const result = parseAgentResponse("lawyer", raw);
    expect(result.status).toBe("approved");
  });

  it("returns error for invalid response", () => {
    const result = parseAgentResponse("lawyer", "not json at all");
    expect(result.status).toBe("error");
    expect(result.error).toBeDefined();
    expect(result.errorKind).toBe("parse");
  });

  it("detects model refusal", () => {
    const result = parseAgentResponse(
      "lawyer",
      "Я не могу на эти темы разговаривать"
    );
    expect(result.status).toBe("error");
    expect(result.errorKind).toBe("refusal");
  });
});
