import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1';

type PlanCode = 'pro' | 'team';

const DEFAULT_ALLOWED_ORIGINS = ['http://localhost:5173', 'http://127.0.0.1:5173'];
const CORS_BASE_HEADERS = {
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-api-version',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Max-Age': '86400'
};

const parseCsv = (value: string | undefined | null, fallback: string[] = []) => {
  const parsed = (value ?? '')
    .split(',')
    .map((item) => item.trim())
    .filter((item) => item.length > 0);
  return parsed.length > 0 ? parsed : fallback;
};

const allowedOrigins = parseCsv(Deno.env.get('ALLOWED_ORIGINS'), DEFAULT_ALLOWED_ORIGINS);
const redirectAllowedOrigins = parseCsv(Deno.env.get('CHECKOUT_REDIRECT_ORIGINS'), allowedOrigins);

const getAllowedOrigin = (request: Request): string | null => {
  const origin = request.headers.get('origin');
  if (!origin) {
    return null;
  }
  return allowedOrigins.includes(origin) ? origin : null;
};

const corsHeaders = (request: Request, allowedOrigin: string | null) => ({
  ...CORS_BASE_HEADERS,
  ...(allowedOrigin ? { 'Access-Control-Allow-Origin': allowedOrigin } : {})
});

const badRequest = (request: Request, message: string, status = 400) =>
  new Response(JSON.stringify({ error: message }), {
    status,
    headers: { ...corsHeaders(request, getAllowedOrigin(request)), 'Content-Type': 'application/json' }
  });

const isAllowedRedirectUrl = (value: string): boolean => {
  let parsed: URL;
  try {
    parsed = new URL(value);
  } catch {
    return false;
  }

  const originAllowed = redirectAllowedOrigins.includes(parsed.origin);
  if (!originAllowed) {
    return false;
  }

  if (parsed.protocol === 'https:') {
    return true;
  }

  return parsed.protocol === 'http:' && (parsed.hostname === 'localhost' || parsed.hostname === '127.0.0.1');
};

const getMonthBounds = () => {
  const now = new Date();
  const periodStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const periodEnd = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1));

  return {
    periodStart: periodStart.toISOString(),
    periodEnd: periodEnd.toISOString()
  };
};

const stripeRequest = async (
  secretKey: string,
  path: string,
  params: Record<string, string>
): Promise<Record<string, unknown>> => {
  const body = new URLSearchParams(params);
  const response = await fetch(`https://api.stripe.com/v1/${path}`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${secretKey}`,
      'Content-Type': 'application/x-www-form-urlencoded'
    },
    body
  });

  const payload = (await response.json()) as Record<string, unknown>;
  if (!response.ok) {
    const err = payload.error as { message?: string } | undefined;
    throw new Error(err?.message ?? `Stripe request failed (${response.status})`);
  }

  return payload;
};

Deno.serve(async (request) => {
  const allowedOrigin = getAllowedOrigin(request);

  if (request.method === 'OPTIONS') {
    if (request.headers.get('origin') && !allowedOrigin) {
      return new Response(null, { status: 403 });
    }
    return new Response(null, { status: 204, headers: corsHeaders(request, allowedOrigin) });
  }

  if (request.headers.get('origin') && !allowedOrigin) {
    return badRequest(request, 'Origin not allowed', 403);
  }

  if (request.method !== 'POST') {
    return badRequest(request, 'Method not allowed', 405);
  }

  const authHeader = request.headers.get('Authorization');
  if (!authHeader) {
    return badRequest(request, 'Missing authorization header', 401);
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY');
  const supabaseServiceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  const stripeSecretKey = Deno.env.get('STRIPE_SECRET_KEY');
  const priceIdPro = Deno.env.get('STRIPE_PRICE_ID_PRO');
  const priceIdTeam = Deno.env.get('STRIPE_PRICE_ID_TEAM');

  if (!supabaseUrl || !supabaseAnonKey || !supabaseServiceRoleKey) {
    return badRequest(request, 'Server missing Supabase config', 500);
  }

  if (!stripeSecretKey) {
    return badRequest(request, 'Server missing STRIPE_SECRET_KEY', 500);
  }

  const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    global: {
      headers: {
        Authorization: authHeader
      }
    }
  });

  const admin = createClient(supabaseUrl, supabaseServiceRoleKey);

  const { data: userData, error: userError } = await supabase.auth.getUser();
  if (userError || !userData.user) {
    return badRequest(request, 'Invalid auth session', 401);
  }

  let payload: { planCode?: PlanCode; successUrl?: string; cancelUrl?: string };
  try {
    payload = (await request.json()) as { planCode?: PlanCode; successUrl?: string; cancelUrl?: string };
  } catch {
    return badRequest(request, 'Invalid JSON payload');
  }

  const { planCode, successUrl, cancelUrl } = payload;
  if (!planCode || !['pro', 'team'].includes(planCode)) {
    return badRequest(request, 'Only paid plans (pro/team) support Stripe checkout.');
  }

  if (!successUrl || !cancelUrl) {
    return badRequest(request, 'Missing successUrl or cancelUrl.');
  }

  if (!isAllowedRedirectUrl(successUrl) || !isAllowedRedirectUrl(cancelUrl)) {
    return badRequest(request, 'Invalid successUrl or cancelUrl origin.');
  }

  const priceIdByPlan: Record<PlanCode, string | undefined> = {
    pro: priceIdPro,
    team: priceIdTeam
  };

  const selectedPriceId = priceIdByPlan[planCode];
  if (!selectedPriceId) {
    return badRequest(request, `Stripe price id missing for plan ${planCode}`, 500);
  }

  const { data: existingSubscription, error: subscriptionError } = await admin
    .from('subscriptions')
    .select('id, stripe_customer_id')
    .eq('user_id', userData.user.id)
    .eq('status', 'active')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (subscriptionError) {
    return badRequest(request, `Failed to load subscription: ${subscriptionError.message}`, 500);
  }

  let subscriptionId = existingSubscription?.id as string | undefined;
  let stripeCustomerId = existingSubscription?.stripe_customer_id as string | undefined;

  if (!subscriptionId) {
    const { periodStart, periodEnd } = getMonthBounds();
    const { data: inserted, error: insertError } = await admin
      .from('subscriptions')
      .insert({
        user_id: userData.user.id,
        plan_code: 'starter',
        status: 'active',
        period_start: periodStart,
        period_end: periodEnd,
        included_scans: 5,
        included_ai_fixes: 10,
        overage_ai_fix_enabled: false,
        overage_ai_fix_price_cents: 0
      })
      .select('id, stripe_customer_id')
      .single();

    if (insertError) {
      return badRequest(request, `Failed to initialize subscription: ${insertError.message}`, 500);
    }

    subscriptionId = inserted.id as string;
    stripeCustomerId = inserted.stripe_customer_id as string | undefined;
  }

  if (!stripeCustomerId) {
    const customer = await stripeRequest(stripeSecretKey, 'customers', {
      email: userData.user.email ?? '',
      'metadata[supabase_user_id]': userData.user.id
    });

    stripeCustomerId = String(customer.id ?? '');
    if (!stripeCustomerId) {
      return badRequest(request, 'Stripe customer creation returned empty id.', 502);
    }

    const { error: updateCustomerError } = await admin
      .from('subscriptions')
      .update({ stripe_customer_id: stripeCustomerId })
      .eq('id', subscriptionId);

    if (updateCustomerError) {
      return badRequest(request, `Failed to persist Stripe customer id: ${updateCustomerError.message}`, 500);
    }
  }

  let checkoutSession: Record<string, unknown>;
  try {
    checkoutSession = await stripeRequest(stripeSecretKey, 'checkout/sessions', {
      mode: 'subscription',
      customer: stripeCustomerId,
      success_url: successUrl,
      cancel_url: cancelUrl,
      allow_promotion_codes: 'true',
      client_reference_id: userData.user.id,
      'line_items[0][price]': selectedPriceId,
      'line_items[0][quantity]': '1',
      'metadata[supabase_user_id]': userData.user.id,
      'metadata[plan_code]': planCode,
      'subscription_data[metadata][supabase_user_id]': userData.user.id,
      'subscription_data[metadata][plan_code]': planCode
    });
  } catch (error) {
    return badRequest(request, error instanceof Error ? error.message : 'Unable to create Stripe checkout session', 502);
  }

  return new Response(
    JSON.stringify({
      url: checkoutSession.url,
      sessionId: checkoutSession.id
    }),
    {
      status: 200,
      headers: { ...corsHeaders(request, allowedOrigin), 'Content-Type': 'application/json' }
    }
  );
});
