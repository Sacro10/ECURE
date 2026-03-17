import { getSupabaseClient } from './supabase';

export type BillingUnit = 'scan_run' | 'ai_fix';

export interface BillingUsageSummary {
  subscriptionId: string;
  planCode: 'starter' | 'pro' | 'team';
  status: 'active' | 'canceled' | 'past_due';
  periodStart: string;
  periodEnd: string;
  includedScans: number;
  usedScans: number;
  remainingScans: number;
  includedAiFixes: number;
  usedAiFixes: number;
  remainingAiFixes: number;
  overageAiFixes: number;
  overageAiFixEnabled: boolean;
  overageAiFixPriceCents: number;
  canRunScan: boolean;
  canRunAiFix: boolean;
  aiFixUnitPriceCents: number;
}

interface BillingDecision {
  allowed: boolean;
  reason: string | null;
  summary: BillingUsageSummary;
}

export type BillingPlanCode = BillingUsageSummary['planCode'];

const toNumber = (value: unknown, fallback = 0): number => {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === 'string') {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }

  return fallback;
};

const toBoolean = (value: unknown, fallback = false): boolean => {
  if (typeof value === 'boolean') {
    return value;
  }

  if (typeof value === 'string') {
    if (value.toLowerCase() === 'true') {
      return true;
    }
    if (value.toLowerCase() === 'false') {
      return false;
    }
  }

  return fallback;
};

const normalizeSummary = (payload: unknown): BillingUsageSummary => {
  const summary = (payload ?? {}) as Record<string, unknown>;

  return {
    subscriptionId: String(summary.subscriptionId ?? ''),
    planCode: (summary.planCode as BillingUsageSummary['planCode']) ?? 'starter',
    status: (summary.status as BillingUsageSummary['status']) ?? 'active',
    periodStart: String(summary.periodStart ?? ''),
    periodEnd: String(summary.periodEnd ?? ''),
    includedScans: toNumber(summary.includedScans),
    usedScans: toNumber(summary.usedScans),
    remainingScans: toNumber(summary.remainingScans),
    includedAiFixes: toNumber(summary.includedAiFixes),
    usedAiFixes: toNumber(summary.usedAiFixes),
    remainingAiFixes: toNumber(summary.remainingAiFixes),
    overageAiFixes: toNumber(summary.overageAiFixes),
    overageAiFixEnabled: toBoolean(summary.overageAiFixEnabled),
    overageAiFixPriceCents: toNumber(summary.overageAiFixPriceCents),
    canRunScan: toBoolean(summary.canRunScan),
    canRunAiFix: toBoolean(summary.canRunAiFix),
    aiFixUnitPriceCents: toNumber(summary.aiFixUnitPriceCents)
  };
};

const normalizeDecision = (payload: unknown): BillingDecision => {
  const result = (payload ?? {}) as Record<string, unknown>;

  return {
    allowed: toBoolean(result.allowed),
    reason: (result.reason as string | null | undefined) ?? null,
    summary: normalizeSummary(result.summary)
  };
};

const runRpc = async (fn: string, args?: Record<string, unknown>) => {
  const supabase = getSupabaseClient() as unknown as {
    rpc: (
      name: string,
      parameters?: Record<string, unknown>
    ) => Promise<{ data: unknown; error: { message: string } | null }>;
  };
  const { data, error } = await supabase.rpc(fn, args);

  if (error) {
    throw new Error(error.message);
  }

  return data;
};

export const fetchUsageSummary = async (): Promise<BillingUsageSummary> => {
  const data = await runRpc('billing_get_usage_summary');
  return normalizeSummary(data);
};

export const canUseUnit = async (unit: BillingUnit): Promise<BillingDecision> => {
  const data = await runRpc('billing_can_use_unit', { p_unit: unit });
  return normalizeDecision(data);
};

export const recordUsage = async (
  unit: BillingUnit,
  metadata?: Record<string, unknown>
): Promise<BillingDecision> => {
  const data = await runRpc('billing_record_usage', {
    p_unit: unit,
    p_quantity: 1,
    p_meta: metadata ?? {}
  });

  return normalizeDecision(data);
};

export const setPlan = async (planCode: BillingPlanCode): Promise<BillingUsageSummary> => {
  const data = await runRpc('billing_set_plan', { p_plan_code: planCode });
  return normalizeSummary(data);
};
