"use client";

import { create } from "zustand";
import { getSortedAgents } from "@/lib/agents/config";
import { runAgentPipeline } from "@/lib/pipeline/runner";
import type { AgentResult, PipelineStatus, ReviewRecord } from "@/types/agent";
import type { UploadedFile } from "@/types/document";

interface AgentFlowState {
  documentText: string;
  uploadedFile: UploadedFile | null;
  agentResults: Record<string, AgentResult>;
  pipelineStatus: PipelineStatus;
  currentAgentId: string | null;
  pipelineError: string | null;
  elapsedSeconds: number;
  revisedText: string | null;
  setDocumentText: (text: string) => void;
  setUploadedFile: (file: UploadedFile | null) => void;
  setAgentResult: (agentId: string, result: AgentResult) => void;
  setPipelineStatus: (status: PipelineStatus) => void;
  setCurrentAgentId: (agentId: string | null) => void;
  setPipelineError: (error: string | null) => void;
  setElapsedSeconds: (seconds: number) => void;
  setRevisedText: (text: string | null) => void;
  resetPipeline: () => void;
  runPipeline: () => Promise<void>;
  retryAgent: (agentId: string) => Promise<void>;
  loadFromHistory: (record: ReviewRecord) => void;
}

function createInitialResults(): Record<string, AgentResult> {
  return getSortedAgents().reduce<Record<string, AgentResult>>((acc, agent) => {
    acc[agent.id] = {
      agentId: agent.id,
      status: "pending",
      comment: "",
    };
    return acc;
  }, {});
}

function resultsToRecord(
  results: Record<string, AgentResult>
): Record<string, AgentResult> {
  return getSortedAgents().reduce<Record<string, AgentResult>>((acc, agent) => {
    const existing = results[agent.id];
    acc[agent.id] = existing ?? {
      agentId: agent.id,
      status: "pending",
      comment: "",
    };
    return acc;
  }, {});
}

export const useAgentFlowStore = create<AgentFlowState>((set, get) => ({
  documentText: "",
  uploadedFile: null,
  agentResults: createInitialResults(),
  pipelineStatus: "idle",
  currentAgentId: null,
  pipelineError: null,
  elapsedSeconds: 0,
  revisedText: null,

  setDocumentText: (text) =>
    set((state) => ({
      documentText: text,
      revisedText: text !== state.documentText ? null : state.revisedText,
    })),

  setUploadedFile: (file) => set({ uploadedFile: file }),

  setAgentResult: (agentId, result) =>
    set((state) => ({
      agentResults: {
        ...state.agentResults,
        [agentId]: result,
      },
    })),

  setPipelineStatus: (status) => set({ pipelineStatus: status }),

  setCurrentAgentId: (agentId) => set({ currentAgentId: agentId }),

  setPipelineError: (error) => set({ pipelineError: error }),

  setElapsedSeconds: (seconds) => set({ elapsedSeconds: seconds }),

  setRevisedText: (text) => set({ revisedText: text }),

  resetPipeline: () =>
    set({
      agentResults: createInitialResults(),
      pipelineStatus: "idle",
      currentAgentId: null,
      pipelineError: null,
      elapsedSeconds: 0,
      revisedText: null,
    }),

  loadFromHistory: (record) => {
    const agentResults = resultsToRecord(
      record.agentResults.reduce<Record<string, AgentResult>>((acc, result) => {
        acc[result.agentId] = result;
        return acc;
      }, {})
    );

    set({
      documentText: record.documentText,
      uploadedFile: null,
      agentResults,
      pipelineStatus: "completed",
      currentAgentId: null,
      pipelineError: null,
      elapsedSeconds: record.elapsedSeconds,
      revisedText: null,
    });
  },

  runPipeline: async () => {
    const { documentText, pipelineStatus } = get();

    if (pipelineStatus === "running") return;

    set({
      pipelineStatus: "running",
      pipelineError: null,
      elapsedSeconds: 0,
      agentResults: createInitialResults(),
      currentAgentId: null,
      revisedText: null,
    });

    const timer = setInterval(() => {
      set((state) => ({ elapsedSeconds: state.elapsedSeconds + 1 }));
    }, 1000);

    try {
      await runAgentPipeline(documentText, (agentId, phase, result) => {
        if (phase === "processing") {
          set({ currentAgentId: agentId });
          set((state) => ({
            agentResults: {
              ...state.agentResults,
              [agentId]: {
                agentId,
                status: "processing",
                comment: "",
              },
            },
          }));
        } else if (result) {
          set((state) => ({
            agentResults: {
              ...state.agentResults,
              [agentId]: result,
            },
          }));
        }
      });

      const state = get();
      set({ pipelineStatus: "completed", currentAgentId: null });

      void import("@/store/useHistoryStore").then(({ useHistoryStore }) => {
        useHistoryStore.getState().addReview({
          documentText: state.documentText,
          agentResults: state.agentResults,
          elapsedSeconds: state.elapsedSeconds,
        });
      });
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "Произошла ошибка при анализе документа";
      set({
        pipelineStatus: "error",
        pipelineError: message,
        currentAgentId: null,
      });
    } finally {
      clearInterval(timer);
    }
  },

  retryAgent: async (agentId) => {
    const { documentText, agentResults, pipelineStatus } = get();
    if (!documentText.trim()) return;

    const previousResults = Object.values(agentResults).filter(
      (r) =>
        r.agentId !== agentId &&
        r.status !== "pending" &&
        r.status !== "processing"
    );

    set({ currentAgentId: agentId, pipelineError: null, revisedText: null });
    set((state) => ({
      agentResults: {
        ...state.agentResults,
        [agentId]: {
          agentId,
          status: "processing",
          comment: "",
        },
      },
    }));

    try {
      const response = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ agentId, documentText, previousResults }),
      });

      if (!response.ok) {
        const data = (await response.json()) as { error?: string };
        throw new Error(data.error ?? "Ошибка при повторном анализе");
      }

      const data = (await response.json()) as AgentResult;
      set((state) => ({
        agentResults: {
          ...state.agentResults,
          [agentId]: {
            ...data,
            processedAt: new Date().toISOString(),
          },
        },
        currentAgentId: null,
      }));

      if (pipelineStatus === "completed") {
        const updated = get();
        void import("@/store/useHistoryStore").then(({ useHistoryStore }) => {
          useHistoryStore.getState().addReview({
            documentText: updated.documentText,
            agentResults: updated.agentResults,
            elapsedSeconds: updated.elapsedSeconds,
          });
        });
      }
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Ошибка при повторном анализе";
      set((state) => ({
        agentResults: {
          ...state.agentResults,
          [agentId]: {
            agentId,
            status: "error",
            comment: "",
            error: message,
            errorKind: "network",
          },
        },
        currentAgentId: null,
        pipelineError: message,
      }));
    }
  },
}));
