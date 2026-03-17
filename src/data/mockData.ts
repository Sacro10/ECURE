import type { ScanResult, Vulnerability } from '../types';

export const MOCK_VULNERABILITIES: Vulnerability[] = [
  {
    id: 'VULN-001',
    title: 'Hardcoded Supabase Service Key',
    description:
      'A service role key is committed in source code, granting elevated database access if leaked.',
    severity: 'Critical',
    location: 'src/lib/supabaseAdmin.ts:4'
  },
  {
    id: 'VULN-002',
    title: 'Missing RLS Policies on users table',
    description:
      'Row Level Security is disabled, allowing unrestricted reads and writes from authenticated clients.',
    severity: 'High',
    location: 'supabase/migrations/202603110923_users.sql:1'
  },
  {
    id: 'VULN-003',
    title: 'SQL Injection in search endpoint',
    description:
      'Query string input is concatenated into raw SQL without parameterization in product search API.',
    severity: 'High',
    location: 'pages/api/search.ts:27'
  },
  {
    id: 'VULN-004',
    title: 'IDOR on order route',
    description:
      'Order ID from route params is fetched without checking ownership, exposing other users\' orders.',
    severity: 'Medium',
    location: 'app/api/orders/[id]/route.ts:41'
  },
  {
    id: 'VULN-005',
    title: 'Insecure CORS wildcard with credentials',
    description:
      'API allows wildcard origin while enabling credentials, enabling cross-origin session abuse.',
    severity: 'Medium',
    location: 'server/middleware/security.ts:18'
  },
  {
    id: 'VULN-006',
    title: 'Verbose auth error disclosure',
    description:
      'Login responses reveal whether an email exists, enabling user enumeration.',
    severity: 'Low',
    location: 'src/routes/auth/login.ts:53'
  }
];

export const MOCK_TECH_STACK = ['Next.js', 'TypeScript', 'PostgreSQL', 'Supabase', 'Tailwind CSS'];

export const SCAN_STEPS = [
  'Connecting to repository endpoint...',
  'Cloning source tree in secure sandbox...',
  'Detecting framework and dependency graph...',
  'Mapping API routes and auth boundaries...',
  'Crawling env usage and secret patterns...',
  'Running static analysis ruleset (OWASP Top 10)...',
  'Checking SQL query construction paths...',
  'Inspecting access-control checks for IDOR...',
  'Correlating findings with risk scoring model...',
  'Preparing remediation suggestions with Gemini...'
];

export const buildMockResult = (url: string): ScanResult => ({
  url,
  score: 42,
  timestamp: new Date().toLocaleString(),
  vulnerabilities: MOCK_VULNERABILITIES,
  techStack: MOCK_TECH_STACK
});
