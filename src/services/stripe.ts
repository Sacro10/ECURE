import type { BillingPlanCode, BillingUsageSummary } from './billing';
import { getSupabaseClient } from './supabase';

interface CheckoutSessionResponse {
  url?: string;
  sessionId?: string;
  error?: string;
  message?: string;
  details?: string;
  code?: string | number;
}

const SESSION_EXPIRED_MESSAGE = 'Your session has expired. Please log in again.';
type PaidPlanCode = Exclude<BillingPlanCode, 'starter'>;

const buildRedirectUrl = (checkoutState: 'success' | 'canceled') => {
  const url = new URL(window.location.href);
  url.searchParams.set('checkout', checkoutState);
  if (checkoutState === 'success') {
    url.searchParams.set('session_id', '{CHECKOUT_SESSION_ID}');
  } else {
    url.searchParams.delete('session_id');
  }
  url.hash = 'settings';
  const serialized = url.toString();
  if (checkoutState !== 'success') {
    return serialized;
  }

  // Stripe expects the literal template token in success_url.
  return serialized.replace('%7BCHECKOUT_SESSION_ID%7D', '{CHECKOUT_SESSION_ID}');
};

const ensureAuthenticatedUser = async (): Promise<void> => {
  const supabase = getSupabaseClient();
  const { data: userData, error: userError } = await supabase.auth.getUser();
  if (!userError && userData.user) {
    return;
  }

  const { data: refreshed, error: refreshError } = await supabase.auth.refreshSession();
  if (refreshError || !refreshed.user) {
    throw new Error(SESSION_EXPIRED_MESSAGE);
  }
};

const invokeFunctionWithRetry = async (functionName: string, body: Record<string, unknown>) => {
  const supabase = getSupabaseClient();

  let result = await supabase.functions.invoke(functionName, { body });
  if (result.error && result.response?.status === 401) {
    const { error: refreshError, data: refreshed } = await supabase.auth.refreshSession();
    if (!refreshError && refreshed.session?.access_token) {
      result = await supabase.functions.invoke(functionName, { body });
    }
  }

  return result;
};

const parseFunctionError = async (prefix: string, status: number, response: Response, fallback: string) => {
  let detail = '';

  try {
    const payload = (await response.clone().json()) as CheckoutSessionResponse;
    detail = payload.error ?? payload.message ?? payload.details ?? '';
  } catch {
    try {
      detail = (await response.clone().text()).trim();
    } catch {
      detail = '';
    }
  }

  if (!detail) {
    if (status === 401) {
      detail = SESSION_EXPIRED_MESSAGE;
    } else if (status === 404) {
      detail = 'Required Edge Function is not deployed.';
    } else {
      detail = fallback;
    }
  }

  return `${prefix} (${status}): ${detail}`;
};

export const redirectToStripeCheckout = async (planCode: PaidPlanCode): Promise<void> => {
  await ensureAuthenticatedUser();

  const { data, error, response } = await invokeFunctionWithRetry(
    'create-checkout-session',
    {
      planCode,
      successUrl: buildRedirectUrl('success'),
      cancelUrl: buildRedirectUrl('canceled')
    }
  );

  if (error) {
    if (response) {
      throw new Error(await parseFunctionError('Checkout request failed', response.status, response, error.message));
    }
    throw new Error(`Checkout request failed: ${error.message}`);
  }

  const payload = (data ?? {}) as CheckoutSessionResponse;
  if (!payload.url) {
    throw new Error(payload.error ?? 'Checkout URL was not returned.');
  }

  window.location.assign(payload.url);
};

interface ConfirmCheckoutResponse {
  usageSummary?: BillingUsageSummary;
  error?: string;
  message?: string;
  details?: string;
  code?: string | number;
}

export const confirmStripeCheckoutSession = async (sessionId: string): Promise<BillingUsageSummary | null> => {
  await ensureAuthenticatedUser();

  const { data, error, response } = await invokeFunctionWithRetry(
    'confirm-checkout-session',
    {
      sessionId
    }
  );

  if (error) {
    if (response) {
      throw new Error(await parseFunctionError('Checkout confirmation failed', response.status, response, error.message));
    }
    throw new Error(`Checkout confirmation failed: ${error.message}`);
  }

  const payload = (data ?? {}) as ConfirmCheckoutResponse;
  if (payload.error) {
    throw new Error(payload.error);
  }

  return payload.usageSummary ?? null;
};
