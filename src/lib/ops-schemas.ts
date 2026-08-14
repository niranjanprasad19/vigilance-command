// Shared, client-safe validation schemas for the server-authoritative ops layer.
import { z } from "zod";

export type Role = "operator" | "supervisor" | "commander" | "auditor";
export type OpsMode = "TRAINING" | "LIVE";

const mode = z.enum(["TRAINING", "LIVE"]);
const classification = z.enum(["UNCLASSIFIED", "RESTRICTED", "CONFIDENTIAL", "SECRET"]);

export const auditInput = z.object({
  kind: z.string().min(1).max(64),
  payload: z.record(z.string(), z.unknown()).default({}),
  mode,
  classification: classification.optional(),
  idempotencyKey: z.string().max(120).optional(),
});

// Provenance shared by every decision + tasking write.
const provenance = {
  sourceSensor: z.string().max(64).optional(),
  sensorBand: z.string().max(16).optional(),
  fusionStep: z.string().max(32).optional(),
  observedAt: z.string().max(40).optional(), // ISO timestamp
};

const decisionCore = {
  eventId: z.string().min(1).max(200),
  entityId: z.string().max(200).optional(),
  entityLabel: z.string().max(200).optional(),
  level: z.number().int().min(1).max(5),
  action: z.string().min(1).max(500),
  rationale: z.string().min(1).max(1000),
  score: z.number().min(0).max(1).optional(),
  confidence: z.number().min(0).max(1).optional(),
  severity: z.string().max(32).optional(),
  modelVersion: z.string().max(64).default("vigilance-triage-1.0.0"),
  policyVersion: z.number().int().optional(),
  mode,
  ...provenance,
};

export const autoDecisionInput = z.object({
  ...decisionCore,
  autoExecute: z.boolean(),
});

export const resolveInput = z.object({
  ...decisionCore,
  outcome: z.enum(["APPROVED", "MODIFIED", "REJECTED"]),
  modifiedAction: z.string().max(500).optional(),
  // Short-lived step-up token, required when the server-derived level meets the
  // dual-confirm floor. Verified server-side against the signing key.
  stepUpToken: z.string().max(2048).optional(),
});

export const taskingInput = z.object({
  asset: z.string().min(1).max(64),
  directive: z.string().min(1).max(500),
  source: z.enum(["AI-AUTO", "OPERATOR"]),
  triggerLevel: z.number().int().min(1).max(5).optional(),
  triggerLabel: z.string().max(200).optional(),
  mode,
  clientRequestId: z.string().max(120).optional(),
  ...provenance,
});

export const roeInput = z.object({
  name: z.string().min(1).max(80),
  thresholds: z.object({
    l2: z.number().min(0).max(1),
    l3: z.number().min(0).max(1),
    l4: z.number().min(0).max(1),
    l5: z.number().min(0).max(1),
    critical_bump: z.number().int().min(0).max(2),
    low_confidence_bump: z.number().int().min(0).max(2),
    low_confidence_below: z.number().min(0).max(1),
  }),
  autoExecuteCeiling: z.number().int().min(0).max(5),
  dualConfirmFrom: z.number().int().min(1).max(5),
  mode,
});

export type RoeThresholds = z.infer<typeof roeInput>["thresholds"];
