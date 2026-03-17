import type { Vulnerability } from '../types';
import type { BillingUsageSummary } from './billing';
import { getSupabaseClient } from './supabase';

interface AiFixResponse {
  markdown?: string;
  usageSummary?: BillingUsageSummary;
  error?: string;
  message?: string;
  details?: string;
  code?: string | number;
}

export interface GenerateFixResult {
  markdown: string;
  usageSummary?: BillingUsageSummary;
}

const SESSION_EXPIRED_MESSAGE = 'Your session has expired. Please log in again.';

const ensureAuthenticatedSessionToken = async (): Promise<string> => {
  const supabase = getSupabaseClient();
  const { data: userData, error: userError } = await supabase.auth.getUser();
  if (!userError && userData.user) {
    const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
    if (!sessionError && sessionData.session?.access_token) {
      return sessionData.session.access_token;
    }
  }

  const { error: refreshError, data: refreshed } = await supabase.auth.refreshSession();
  if (!refreshError && refreshed.session?.access_token) {
    return refreshed.session.access_token;
  }

  throw new Error(SESSION_EXPIRED_MESSAGE);
};

const invokeAiFix = async (
  token: string,
  vulnerability: Vulnerability,
  techStack: string[]
) => {
  const supabase = getSupabaseClient();

  return supabase.functions.invoke('ai-fix', {
    body: {
      vulnerability,
      techStack
    },
    headers: {
      Authorization: `Bearer ${token}`
    }
  });
};

export const generateFixWithGemini = async (
  vulnerability: Vulnerability,
  techStack: string[]
): Promise<GenerateFixResult> => {
  const supabase = getSupabaseClient();
  let token = await ensureAuthenticatedSessionToken();

  let { data, error, response } = await invokeAiFix(token, vulnerability, techStack);

  if (error && response?.status === 401) {
    const { error: refreshError, data: refreshed } = await supabase.auth.refreshSession();
    if (!refreshError && refreshed.session?.access_token) {
      token = refreshed.session.access_token;
      const retryResult = await invokeAiFix(token, vulnerability, techStack);
      data = retryResult.data;
      error = retryResult.error;
      response = retryResult.response;
    }
  }

  if (error) {
    if (response) {
      const status = response.status;
      let detail = '';

      try {
        const payload = (await response.clone().json()) as AiFixResponse;
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
          detail = 'Edge Function "ai-fix" is not deployed.';
        } else {
          detail = error.message;
        }
      }

      throw new Error(`AI fix request failed (${status}): ${detail}`);
    }

    throw new Error(`AI fix request failed: ${error.message}`);
  }

  const payload = (data ?? {}) as AiFixResponse;
  const markdown = payload.markdown?.trim() ?? '';

  if (!markdown) {
    throw new Error('AI fix returned an empty response.');
  }

  return {
    markdown,
    usageSummary: payload.usageSummary
  };
};
