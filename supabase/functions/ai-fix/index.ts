import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1';

const MODEL_NAME = 'gemini-2.5-flash';
const DEFAULT_ALLOWED_ORIGINS = ['http://localhost:5173', 'http://127.0.0.1:5173'];
const CORS_BASE_HEADERS = {
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-api-version',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Max-Age': '86400'
};

interface VulnerabilityInput {
  id?: string;
  title: string;
  severity: string;
  description: string;
  location: string;
}

interface GeminiGenerateResponse {
  candidates?: Array<{
    content?: {
      parts?: Array<{ text?: string }>;
    };
  }>;
  usageMetadata?: {
    promptTokenCount?: number;
    candidatesTokenCount?: number;
    totalTokenCount?: number;
  };
}

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

const toPrompt = (vulnerability: VulnerabilityInput, techStack: string[]) => {
  return [
    'You are a senior application security engineer.',
    'Provide a secure remediation in markdown with these exact sections:',
    '1) Root Cause',
    '2) Fix Strategy',
    '3) Before (code block)',
    '4) After (code block)',
    '5) Validation Checklist',
    '',
    'Be concise and actionable. Avoid long prose. Keep code examples minimal and production-safe.',
    '',
    `Title: ${vulnerability.title}`,
    `Severity: ${vulnerability.severity}`,
    `Description: ${vulnerability.description}`,
    `Location: ${vulnerability.location}`,
    `Tech Stack: ${techStack.join(', ') || 'Unknown'}`
  ].join('\n');
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
  const geminiApiKey = Deno.env.get('GEMINI_API_KEY') ?? Deno.env.get('GOOGLE_API_KEY');

  if (!supabaseUrl || !supabaseAnonKey) {
    return badRequest(request, 'Server missing Supabase config', 500);
  }

  if (!geminiApiKey) {
    return badRequest(request, 'Server missing Gemini API key', 500);
  }

  const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    global: {
      headers: {
        Authorization: authHeader
      }
    }
  });

  const { data: userData, error: userError } = await supabase.auth.getUser();
  if (userError || !userData.user) {
    return badRequest(request, 'Invalid auth session', 401);
  }

  let payload: { vulnerability?: VulnerabilityInput; techStack?: string[] };
  try {
    payload = (await request.json()) as { vulnerability?: VulnerabilityInput; techStack?: string[] };
  } catch {
    return badRequest(request, 'Invalid JSON payload');
  }

  const vulnerability = payload.vulnerability;
  if (!vulnerability?.title || !vulnerability.description || !vulnerability.location || !vulnerability.severity) {
    return badRequest(request, 'Missing vulnerability fields');
  }

  const techStack = Array.isArray(payload.techStack)
    ? payload.techStack.filter((item) => typeof item === 'string' && item.trim().length > 0)
    : [];

  const { data: canUseResponse, error: canUseError } = await supabase.rpc('billing_can_use_unit', { p_unit: 'ai_fix' });
  if (canUseError) {
    return badRequest(request, `Quota check failed: ${canUseError.message}`, 500);
  }

  const allowed = Boolean((canUseResponse as { allowed?: boolean } | null)?.allowed);
  if (!allowed) {
    const reason = (canUseResponse as { reason?: string } | null)?.reason ?? 'AI fix quota reached.';
    const summary = (canUseResponse as { summary?: unknown } | null)?.summary ?? null;

    return new Response(JSON.stringify({ error: reason, usageSummary: summary }), {
      status: 402,
      headers: { ...corsHeaders(request, allowedOrigin), 'Content-Type': 'application/json' }
    });
  }

  const prompt = toPrompt(vulnerability, techStack);
  const startedAt = Date.now();

  const geminiResponse = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${MODEL_NAME}:generateContent?key=${geminiApiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        generationConfig: {
          temperature: 0.3,
          topP: 0.9,
          maxOutputTokens: 1200
        }
      })
    }
  );

  if (!geminiResponse.ok) {
    const details = await geminiResponse.text();
    return badRequest(request, `Gemini API error (${geminiResponse.status}): ${details}`, 502);
  }

  const geminiData = (await geminiResponse.json()) as GeminiGenerateResponse;
  const markdown = geminiData.candidates
    ?.flatMap((candidate) => candidate.content?.parts ?? [])
    .map((part) => part.text ?? '')
    .join('\n')
    .trim();

  if (!markdown) {
    return badRequest(request, 'Gemini returned empty output', 502);
  }

  const usageMetadata = {
    model: MODEL_NAME,
    latency_ms: Date.now() - startedAt,
    prompt_tokens: geminiData.usageMetadata?.promptTokenCount ?? null,
    output_tokens: geminiData.usageMetadata?.candidatesTokenCount ?? null,
    total_tokens: geminiData.usageMetadata?.totalTokenCount ?? null,
    vulnerability_id: vulnerability.id ?? vulnerability.title,
    tech_stack: techStack
  };

  const { data: recordUsageResponse, error: recordUsageError } = await supabase.rpc('billing_record_usage', {
    p_unit: 'ai_fix',
    p_quantity: 1,
    p_meta: usageMetadata
  });

  if (recordUsageError) {
    return badRequest(request, `Usage logging failed: ${recordUsageError.message}`, 500);
  }

  const usageSummary = (recordUsageResponse as { summary?: unknown } | null)?.summary ?? null;

  return new Response(
    JSON.stringify({
      markdown,
      usageSummary,
      model: MODEL_NAME
    }),
    {
      status: 200,
      headers: { ...corsHeaders(request, allowedOrigin), 'Content-Type': 'application/json' }
    }
  );
});
