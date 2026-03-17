import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1';

type PlanCode = 'starter' | 'pro' | 'team';

type StripeEvent = {
  id?: string;
  type?: string;
  data?: {
    object?: Record<string, unknown>;
  };
};

type PlanPreset = {
  includedScans: number;
  includedAiFixes: number;
  overageAiFixEnabled: boolean;
  overageAiFixPriceCents: number;
};

const PLAN_PRESETS: Record<PlanCode, PlanPreset> = {
  starter: {
    includedScans: 5,
    includedAiFixes: 10,
    overageAiFixEnabled: false,
    overageAiFixPriceCents: 0
  },
  pro: {
    includedScans: 100,
    includedAiFixes: 300,
    overageAiFixEnabled: true,
    overageAiFixPriceCents: 3
  },
  team: {
    includedScans: 500,
    includedAiFixes: 2000,
    overageAiFixEnabled: true,
    overageAiFixPriceCents: 2
  }
};

const webhookError = (message: string, status = 400) =>
  new Response(JSON.stringify({ error: message }), {
    status,
    headers: { 'Content-Type': 'application/json' }
  });

const ok = (body: Record<string, unknown>) =>
  new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'Content-Type': 'application/json' }
  });

const toHex = (buffer: ArrayBuffer): string =>
  [...new Uint8Array(buffer)].map((byte) => byte.toString(16).padStart(2, '0')).join('');

const timingSafeEqual = (a: string, b: string): boolean => {
  if (a.length !== b.length) {
    return false;
  }

  let diff = 0;
  for (let i = 0; i < a.length; i += 1) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return diff === 0;
};

const computeHmac = async (secret: string, payload: string): Promise<string> => {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey('raw', encoder.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const signature = await crypto.subtle.sign('HMAC', key, encoder.encode(payload));
  return toHex(signature);
};

const verifyStripeSignature = async (rawBody: string, signatureHeader: string, secret: string): Promise<boolean> => {
  const parts = signatureHeader.split(',').map((part) => part.trim());
  const timestampPart = parts.find((part) => part.startsWith('t='));
  const signatures = parts.filter((part) => part.startsWith('v1=')).map((part) => part.slice(3));

  if (!timestampPart || signatures.length === 0) {
    return false;
  }

  const timestampValue = Number(timestampPart.slice(2));
  if (!Number.isFinite(timestampValue)) {
    return false;
  }

  const nowSeconds = Math.floor(Date.now() / 1000);
  if (Math.abs(nowSeconds - timestampValue) > 300) {
    return false;
  }

  const signedPayload = `${timestampValue}.${rawBody}`;
  const expectedSignature = await computeHmac(secret, signedPayload);

  return signatures.some((signature) => timingSafeEqual(signature, expectedSignature));
};

const toIsoFromUnix = (value: unknown): string | null => {
  const parsed = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return null;
  }
  return new Date(parsed * 1000).toISOString();
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

const toPlanCode = (value: unknown): PlanCode | null => {
  if (value === 'starter' || value === 'pro' || value === 'team') {
    return value;
  }
  return null;
};

const readStripePriceId = (source: Record<string, unknown> | null): string => {
  if (!source) {
    return '';
  }

  const items = source.items as { data?: Array<Record<string, unknown>> } | undefined;
  const firstItem = items?.data?.[0];
  const price = firstItem?.price as Record<string, unknown> | undefined;
  return String(price?.id ?? '');
};

const stripeGet = async (secretKey: string, path: string): Promise<Record<string, unknown>> => {
  const response = await fetch(`https://api.stripe.com/v1/${path}`, {
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

const resolvePlanFromMetadataOrPrice = (
  metadata: Record<string, unknown> | null,
  priceId: string,
  priceIdPro: string | null,
  priceIdTeam: string | null
): PlanCode | null => {
  const metadataPlan = toPlanCode(metadata?.plan_code);
  if (metadataPlan) {
    return metadataPlan;
  }

  if (priceIdPro && priceId === priceIdPro) {
    return 'pro';
  }
  if (priceIdTeam && priceId === priceIdTeam) {
    return 'team';
  }
  return null;
};

const findUserIdByStripeRefs = async (
  admin: ReturnType<typeof createClient>,
  stripeSubscriptionId: string,
  stripeCustomerId: string
): Promise<string | null> => {
  if (stripeSubscriptionId) {
    const { data } = await admin
      .from('subscriptions')
      .select('user_id')
      .eq('stripe_subscription_id', stripeSubscriptionId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (data?.user_id) {
      return String(data.user_id);
    }
  }

  if (stripeCustomerId) {
    const { data } = await admin
      .from('subscriptions')
      .select('user_id')
      .eq('stripe_customer_id', stripeCustomerId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (data?.user_id) {
      return String(data.user_id);
    }
  }

  return null;
};

const upsertSubscription = async (
  admin: ReturnType<typeof createClient>,
  userId: string,
  planCode: PlanCode,
  stripeCustomerId: string,
  stripeSubscriptionId: string,
  periodStart: string,
  periodEnd: string
) => {
  const preset = PLAN_PRESETS[planCode];
  const updatePayload = {
    plan_code: planCode,
    status: 'active',
    period_start: periodStart,
    period_end: periodEnd,
    included_scans: preset.includedScans,
    included_ai_fixes: preset.includedAiFixes,
    overage_ai_fix_enabled: preset.overageAiFixEnabled,
    overage_ai_fix_price_cents: preset.overageAiFixPriceCents,
    stripe_customer_id: stripeCustomerId || null,
    stripe_subscription_id: stripeSubscriptionId || null
  };

  const { data: existing } = await admin
    .from('subscriptions')
    .select('id')
    .eq('user_id', userId)
    .eq('status', 'active')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (existing?.id) {
    const { error: updateError } = await admin.from('subscriptions').update(updatePayload).eq('id', existing.id);
    if (updateError) {
      throw new Error(`Failed to update subscription: ${updateError.message}`);
    }
    return;
  }

  const { error: insertError } = await admin.from('subscriptions').insert({
    user_id: userId,
    ...updatePayload
  });
  if (insertError) {
    throw new Error(`Failed to insert subscription: ${insertError.message}`);
  }
};

Deno.serve(async (request) => {
  if (request.method !== 'POST') {
    return webhookError('Method not allowed', 405);
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const supabaseServiceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  const stripeWebhookSecret = Deno.env.get('STRIPE_WEBHOOK_SECRET');
  const stripeSecretKey = Deno.env.get('STRIPE_SECRET_KEY');
  const priceIdPro = Deno.env.get('STRIPE_PRICE_ID_PRO');
  const priceIdTeam = Deno.env.get('STRIPE_PRICE_ID_TEAM');

  if (!supabaseUrl || !supabaseServiceRoleKey) {
    return webhookError('Server missing Supabase config', 500);
  }
  if (!stripeWebhookSecret) {
    return webhookError('Server missing STRIPE_WEBHOOK_SECRET', 500);
  }
  if (!stripeSecretKey) {
    return webhookError('Server missing STRIPE_SECRET_KEY', 500);
  }

  const signatureHeader = request.headers.get('Stripe-Signature');
  if (!signatureHeader) {
    return webhookError('Missing Stripe-Signature header', 400);
  }

  const rawBody = await request.text();
  const signatureValid = await verifyStripeSignature(rawBody, signatureHeader, stripeWebhookSecret);
  if (!signatureValid) {
    return webhookError('Invalid webhook signature', 400);
  }

  let event: StripeEvent;
  try {
    event = JSON.parse(rawBody) as StripeEvent;
  } catch {
    return webhookError('Invalid webhook payload', 400);
  }

  const eventType = String(event.type ?? '');
  const payload = (event.data?.object ?? {}) as Record<string, unknown>;
  const admin = createClient(supabaseUrl, supabaseServiceRoleKey);
  const monthBounds = getMonthBounds();

  try {
    if (eventType === 'checkout.session.completed') {
      const mode = String(payload.mode ?? '');
      if (mode !== 'subscription') {
        return ok({ received: true, ignored: true, reason: 'non-subscription checkout' });
      }

      const metadata = (payload.metadata as Record<string, unknown> | undefined) ?? null;
      const stripeCustomerId = String(payload.customer ?? '');
      let stripeSubscriptionId = String(payload.subscription ?? '');
      let stripeSubscription: Record<string, unknown> | null =
        typeof payload.subscription === 'object' ? (payload.subscription as Record<string, unknown>) : null;

      if (!stripeSubscription && stripeSubscriptionId) {
        stripeSubscription = await stripeGet(stripeSecretKey, `subscriptions/${encodeURIComponent(stripeSubscriptionId)}`);
      }
      if (!stripeSubscriptionId && stripeSubscription) {
        stripeSubscriptionId = String(stripeSubscription.id ?? '');
      }

      const priceId = readStripePriceId(stripeSubscription);
      const planCode = resolvePlanFromMetadataOrPrice(metadata, priceId, priceIdPro, priceIdTeam);
      if (!planCode) {
        return ok({ received: true, ignored: true, reason: 'plan not resolvable' });
      }

      let userId = String(metadata?.supabase_user_id ?? payload.client_reference_id ?? '');
      if (!userId) {
        userId = (await findUserIdByStripeRefs(admin, stripeSubscriptionId, stripeCustomerId)) ?? '';
      }
      if (!userId) {
        return ok({ received: true, ignored: true, reason: 'user not resolvable' });
      }

      const periodStart = toIsoFromUnix(stripeSubscription?.current_period_start) ?? monthBounds.periodStart;
      const periodEnd = toIsoFromUnix(stripeSubscription?.current_period_end) ?? monthBounds.periodEnd;

      await upsertSubscription(admin, userId, planCode, stripeCustomerId, stripeSubscriptionId, periodStart, periodEnd);
      return ok({ received: true, updated: true, eventType, userId, planCode });
    }

    if (
      eventType === 'customer.subscription.created' ||
      eventType === 'customer.subscription.updated' ||
      eventType === 'customer.subscription.deleted'
    ) {
      const metadata = (payload.metadata as Record<string, unknown> | undefined) ?? null;
      const stripeSubscriptionId = String(payload.id ?? '');
      const stripeCustomerId = String(payload.customer ?? '');
      const priceId = readStripePriceId(payload);

      let planCode = resolvePlanFromMetadataOrPrice(metadata, priceId, priceIdPro, priceIdTeam);
      if (eventType === 'customer.subscription.deleted') {
        planCode = 'starter';
      }
      if (!planCode) {
        return ok({ received: true, ignored: true, reason: 'plan not resolvable' });
      }

      let userId = String(metadata?.supabase_user_id ?? '');
      if (!userId) {
        userId = (await findUserIdByStripeRefs(admin, stripeSubscriptionId, stripeCustomerId)) ?? '';
      }
      if (!userId) {
        return ok({ received: true, ignored: true, reason: 'user not resolvable' });
      }

      const periodStart = toIsoFromUnix(payload.current_period_start) ?? monthBounds.periodStart;
      const periodEnd = toIsoFromUnix(payload.current_period_end) ?? monthBounds.periodEnd;
      const subscriptionIdToStore = eventType === 'customer.subscription.deleted' ? '' : stripeSubscriptionId;

      await upsertSubscription(admin, userId, planCode, stripeCustomerId, subscriptionIdToStore, periodStart, periodEnd);
      return ok({ received: true, updated: true, eventType, userId, planCode });
    }

    return ok({ received: true, ignored: true, reason: 'event not handled', eventType });
  } catch (error) {
    return webhookError(error instanceof Error ? error.message : 'Webhook processing failed', 500);
  }
});
