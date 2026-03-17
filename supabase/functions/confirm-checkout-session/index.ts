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

const stripeGet = async (secretKey: string, path: string, search = ''): Promise<Record<string, unknown>> => {
  const response = await fetch(`https://api.stripe.com/v1/${path}${search}`, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${secretKey}`
    }
  });

  const payload = (await response.json()) as Record<string, unknown>;
  if (!response.ok) {
    const err = payload.error as { message?: string } | undefined;
    throw new Error(err?.message ?? `Stripe request failed (${response.status})`);
  }

  return payload;
};

const asCheckoutSession = (value: unknown): Record<string, unknown> | null => {
  if (!value || typeof value !== 'object') {
    return null;
  }

  return value as Record<string, unknown>;
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

  let payload: { sessionId?: string };
  try {
    payload = (await request.json()) as { sessionId?: string };
  } catch {
    return badRequest(request, 'Invalid JSON payload');
  }

  let session: Record<string, unknown> | null = null;
  const sessionId = payload.sessionId?.trim() ?? '';
  let directLookupError = sessionId ? '' : 'Missing sessionId';

  if (sessionId) {
    try {
      session = await stripeGet(stripeSecretKey, `checkout/sessions/${encodeURIComponent(sessionId)}`, '?expand[]=subscription');
    } catch (error) {
      directLookupError = error instanceof Error ? error.message : 'Unable to load Stripe session';
    }
  }

  if (!session) {
    const { data: subscriptionRow, error: subscriptionLookupError } = await admin
      .from('subscriptions')
      .select('stripe_customer_id')
      .eq('user_id', userData.user.id)
      .eq('status', 'active')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (subscriptionLookupError) {
      return badRequest(
        request,
        `Unable to load Stripe session: ${directLookupError || 'direct lookup skipped'}; customer lookup failed: ${subscriptionLookupError.message}`,
        502
      );
    }

    const stripeCustomerId = String(subscriptionRow?.stripe_customer_id ?? '');
    if (!stripeCustomerId) {
      return badRequest(
        request,
        `Unable to load Stripe session: ${directLookupError || 'direct lookup skipped'}; no stripe_customer_id on active subscription`,
        502
      );
    }

    let sessionsListPayload: Record<string, unknown>;
    try {
      sessionsListPayload = await stripeGet(
        stripeSecretKey,
        'checkout/sessions',
        `?customer=${encodeURIComponent(stripeCustomerId)}&limit=25&expand[]=data.subscription`
      );
    } catch (listError) {
      const listErrorMessage = listError instanceof Error ? listError.message : 'Unable to list checkout sessions';
      return badRequest(
        request,
        `Unable to load Stripe session: ${directLookupError || 'direct lookup skipped'}; fallback list failed: ${listErrorMessage}`,
        502
      );
    }

    const sessions = Array.isArray(sessionsListPayload.data) ? sessionsListPayload.data : [];
    const matchingSession = sessions
      .map((entry) => asCheckoutSession(entry))
      .find((entry) => {
        if (!entry) {
          return false;
        }

        const mode = String(entry.mode ?? '');
        const status = String(entry.status ?? '');
        const metadata = (entry.metadata as Record<string, unknown> | undefined) ?? {};
        const owner = String(metadata.supabase_user_id ?? entry.client_reference_id ?? '');
        return mode === 'subscription' && status === 'complete' && owner === userData.user.id;
      });

    if (!matchingSession) {
      return badRequest(
        request,
        `Unable to load Stripe session: ${directLookupError || 'direct lookup skipped'}; no completed checkout session found for customer`,
        502
      );
    }

    session = matchingSession;
  }

  if (!session) {
    return badRequest(request, 'Unable to load Stripe session', 502);
  }

  const checkoutStatus = String(session.status ?? '');
  const paymentStatus = String(session.payment_status ?? '');
  const stripeSubscriptionValue = session.subscription;
  const stripeSubscription =
    typeof stripeSubscriptionValue === 'string'
      ? null
      : (stripeSubscriptionValue as Record<string, unknown> | null);
  const subscriptionStatus = String(stripeSubscription?.status ?? '');

  const isPaymentSettled = paymentStatus === 'paid' || paymentStatus === 'no_payment_required';
  const isCheckoutComplete = checkoutStatus === 'complete';
  const isSubscriptionProvisioned = ['active', 'trialing', 'past_due'].includes(subscriptionStatus);

  if (!isPaymentSettled && !isCheckoutComplete && !isSubscriptionProvisioned) {
    return badRequest(
      request,
      `Checkout session is not complete (status=${checkoutStatus}, payment_status=${paymentStatus}, subscription_status=${subscriptionStatus || 'unknown'}).`,
      409
    );
  }

  const sessionUserId = String((session.metadata as Record<string, unknown> | undefined)?.supabase_user_id ?? session.client_reference_id ?? '');
  if (!sessionUserId || sessionUserId !== userData.user.id) {
    return badRequest(request, 'Checkout session does not belong to this user.', 403);
  }

  const planCode = String((session.metadata as Record<string, unknown> | undefined)?.plan_code ?? '') as PlanCode;
  if (!['pro', 'team'].includes(planCode)) {
    return badRequest(request, 'Unsupported plan in checkout session.', 409);
  }

  const { error: setPlanError } = await supabase.rpc('billing_set_plan', { p_plan_code: planCode });
  if (setPlanError) {
    return badRequest(request, `Failed to set plan: ${setPlanError.message}`, 500);
  }

  const stripeCustomerId = String(session.customer ?? '');
  const stripeSubscriptionId =
    typeof stripeSubscriptionValue === 'string'
      ? stripeSubscriptionValue
      : String((stripeSubscriptionValue as Record<string, unknown> | null)?.id ?? '');

  if (stripeCustomerId || stripeSubscriptionId) {
    const { error: updateError } = await admin
      .from('subscriptions')
      .update({
        stripe_customer_id: stripeCustomerId || null,
        stripe_subscription_id: stripeSubscriptionId || null
      })
      .eq('user_id', userData.user.id)
      .eq('status', 'active');

    if (updateError) {
      return badRequest(request, `Failed to persist Stripe subscription metadata: ${updateError.message}`, 500);
    }
  }

  const { data: summary, error: summaryError } = await supabase.rpc('billing_get_usage_summary');
  if (summaryError) {
    return badRequest(request, `Failed to load usage summary: ${summaryError.message}`, 500);
  }

  return new Response(
    JSON.stringify({
      usageSummary: summary
    }),
    {
      status: 200,
      headers: { ...corsHeaders(request, allowedOrigin), 'Content-Type': 'application/json' }
    }
  );
});
