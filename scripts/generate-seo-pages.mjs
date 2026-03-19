import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const SITE_URL = process.env.SEO_SITE_URL ?? 'https://vibesec.info';
const TODAY = new Date().toISOString().slice(0, 10);

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PROJECT_ROOT = path.resolve(__dirname, '..');
const SEO_DIR = path.join(PROJECT_ROOT, 'public', 'seo');
const SITEMAP_PATH = path.join(PROJECT_ROOT, 'public', 'sitemap.xml');
const SITEMAP_V2_PATH = path.join(PROJECT_ROOT, 'public', 'sitemap-v2.xml');

const pages = [
  {
    slug: 'ai-security-scanner',
    keyword: 'AI security scanner',
    title: 'AI Security Scanner for Web Apps | Vibesec',
    description:
      'Run an AI security scanner for modern web apps. Detect OWASP risks, prioritize exploitable findings, and get practical remediation guidance.',
    h1: 'AI Security Scanner for Modern Web Applications',
    intro:
      'Vibesec helps engineering teams run repeatable AI-driven vulnerability scanning against code repositories and live app targets.',
    coverage: [
      'OWASP Top 10 coverage focused on real exploit paths.',
      'Stack-aware checks for auth, API, and data access risk patterns.',
      'Prioritized findings with severity context and fix guidance.'
    ],
    audience: ['Startup engineering teams shipping quickly.', 'Security leads building lightweight DevSecOps workflows.', 'Founders auditing AI-assisted code output.'],
    faqs: [
      {
        question: 'How is this different from a generic vulnerability scanner?',
        answer: 'Vibesec combines security checks with stack context and remediation guidance so teams can fix issues faster.'
      },
      {
        question: 'Can I scan a GitHub repository?',
        answer: 'Yes. You can use repository URLs or app URLs to start the security analysis workflow.'
      }
    ],
    related: ['owasp-top-10-scanner', 'github-security-scanner', 'devsecops-automated-security-testing']
  },
  {
    slug: 'owasp-top-10-scanner',
    keyword: 'OWASP Top 10 scanner',
    title: 'OWASP Top 10 Scanner for AI-Built Apps | Vibesec',
    description:
      'Scan web apps for OWASP Top 10 vulnerabilities. Identify high-risk weaknesses quickly and generate actionable remediation plans.',
    h1: 'OWASP Top 10 Scanner for Vibe-Coded Apps',
    intro:
      'Use Vibesec to continuously detect common and critical web application vulnerabilities mapped to OWASP-aligned categories.',
    coverage: [
      'Broken access control and auth workflow weaknesses.',
      'Injection and insecure data handling risks.',
      'Security misconfiguration and sensitive data exposure patterns.'
    ],
    audience: ['Teams preparing for security reviews.', 'Product engineers adding pre-release checks.', 'Developers who need fast, practical risk triage.'],
    faqs: [
      {
        question: 'Does this replace manual penetration testing?',
        answer: 'No. It accelerates baseline coverage and remediation, and complements manual testing for deeper assessments.'
      },
      {
        question: 'Is this useful for early-stage products?',
        answer: 'Yes. It helps small teams catch high-impact issues before they become expensive incidents.'
      }
    ],
    related: ['web-application-security-scanner', 'ai-security-scanner', 'saas-security-scanner']
  },
  {
    slug: 'github-security-scanner',
    keyword: 'GitHub security scanner',
    title: 'GitHub Security Scanner for Web Repositories | Vibesec',
    description:
      'Analyze GitHub-hosted projects for security weaknesses with an automated scanner built for fast-moving web development teams.',
    h1: 'GitHub Security Scanner for Fast Release Cycles',
    intro:
      'Vibesec provides a practical GitHub security scanning workflow to help teams identify vulnerabilities before production rollout.',
    coverage: [
      'Repository and app-target scanning workflows.',
      'Exploitability-first prioritization for faster triage.',
      'AI-supported remediation guidance tied to findings.'
    ],
    audience: ['Teams deploying weekly or daily.', 'Engineering managers improving secure SDLC outcomes.', 'Developers shipping with AI coding assistants.'],
    faqs: [
      {
        question: 'Can this support pull request review workflows?',
        answer: 'It supports repository-level scanning and can be integrated into broader release and review processes.'
      },
      {
        question: 'What kind of output does it provide?',
        answer: 'Findings include severity context and practical fix guidance for each identified issue.'
      }
    ],
    related: ['ai-code-security-review', 'devsecops-automated-security-testing', 'ai-security-scanner']
  },
  {
    slug: 'web-application-security-scanner',
    keyword: 'web application security scanner',
    title: 'Web Application Security Scanner | Vibesec',
    description:
      'Automated web application security scanner for modern SaaS teams. Detect vulnerabilities and resolve issues with guided remediation.',
    h1: 'Web Application Security Scanner for SaaS Teams',
    intro:
      'Vibesec helps teams test web applications for high-risk vulnerabilities with a practical workflow built for product velocity.',
    coverage: [
      'Targeted scanning for common web app exploit classes.',
      'Risk-focused reporting for engineering triage.',
      'Guided remediation suggestions to reduce time-to-fix.'
    ],
    audience: ['SaaS product teams.', 'Security-conscious startups.', 'Teams formalizing application security programs.'],
    faqs: [
      {
        question: 'How often should teams run scans?',
        answer: 'Most teams scan before major releases and regularly during active development to reduce exposure windows.'
      },
      {
        question: 'Can non-security engineers use it?',
        answer: 'Yes. The workflow is designed for product engineers who need actionable output, not just raw security data.'
      }
    ],
    related: ['saas-security-scanner', 'owasp-top-10-scanner', 'ai-security-scanner']
  },
  {
    slug: 'ai-code-security-review',
    keyword: 'AI code security review',
    title: 'AI Code Security Review for Web Apps | Vibesec',
    description:
      'Run AI-assisted code security reviews to identify vulnerabilities in fast-built web apps and prioritize high-risk issues.',
    h1: 'AI Code Security Review for Vibe-Coded Projects',
    intro:
      'When teams ship quickly with AI coding tools, Vibesec provides a repeatable security review workflow focused on real implementation risk.',
    coverage: [
      'Security analysis tailored to modern JavaScript web stacks.',
      'Detection of exploitable weakness patterns in app logic.',
      'Guided mitigation suggestions for engineers and reviewers.'
    ],
    audience: ['Teams using AI copilots for feature delivery.', 'CTOs validating secure code quality standards.', 'Developers conducting post-build security checks.'],
    faqs: [
      {
        question: 'Is this a static code analyzer?',
        answer: 'It is a broader security scanning workflow that combines findings analysis with remediation support.'
      },
      {
        question: 'Will this help with release confidence?',
        answer: 'Yes. It helps teams catch high-impact issues early and ship with clearer risk visibility.'
      }
    ],
    related: ['github-security-scanner', 'ai-security-scanner', 'penetration-testing-for-startups']
  },
  {
    slug: 'saas-security-scanner',
    keyword: 'SaaS security scanner',
    title: 'SaaS Security Scanner for Product Teams | Vibesec',
    description:
      'Use a SaaS security scanner to test web applications for vulnerabilities, prioritize fixes, and improve security posture over time.',
    h1: 'SaaS Security Scanner for High-Growth Product Teams',
    intro:
      'Vibesec enables lightweight, repeatable security checks that fit into product development cycles without heavy process overhead.',
    coverage: [
      'Baseline vulnerability detection for web SaaS platforms.',
      'Severity-led issue prioritization for sprint planning.',
      'Actionable remediation guidance for engineering teams.'
    ],
    audience: ['Growth-stage SaaS companies.', 'Lean teams adding security controls.', 'Builders preparing for customer security reviews.'],
    faqs: [
      {
        question: 'Can this help prepare for enterprise security questionnaires?',
        answer: 'It helps establish repeatable scanning and remediation practices that support stronger security readiness.'
      },
      {
        question: 'Does it support small teams?',
        answer: 'Yes. It is designed to provide practical signal without requiring a large dedicated security team.'
      }
    ],
    related: ['web-application-security-scanner', 'owasp-top-10-scanner', 'devsecops-automated-security-testing']
  },
  {
    slug: 'devsecops-automated-security-testing',
    keyword: 'DevSecOps automated security testing',
    title: 'DevSecOps Automated Security Testing | Vibesec',
    description:
      'Add automated security testing to your DevSecOps workflow with practical vulnerability scanning and remediation guidance.',
    h1: 'DevSecOps Automated Security Testing for Web Products',
    intro:
      'Vibesec supports secure software delivery by providing automated security checks teams can run consistently throughout the release lifecycle.',
    coverage: [
      'Continuous scanning support for app release checkpoints.',
      'Issue prioritization aligned to exploitability and severity.',
      'Remediation guidance that developers can implement quickly.'
    ],
    audience: ['Engineering teams operationalizing DevSecOps.', 'Leads standardizing security release gates.', 'Product teams aiming to reduce incident risk.'],
    faqs: [
      {
        question: 'How does this fit into release workflows?',
        answer: 'Teams use it as a recurring checkpoint before launches and during active iteration to keep risk visible.'
      },
      {
        question: 'Do I need a dedicated AppSec team first?',
        answer: 'No. It is designed to be usable by product engineering teams while security programs mature.'
      }
    ],
    related: ['github-security-scanner', 'saas-security-scanner', 'ai-security-scanner']
  },
  {
    slug: 'penetration-testing-for-startups',
    keyword: 'penetration testing for startups',
    title: 'Penetration Testing Workflow for Startups | Vibesec',
    description:
      'Startup-friendly penetration testing workflow with automated vulnerability checks and guided remediation for web applications.',
    h1: 'Penetration Testing Workflow Built for Startups',
    intro:
      'Vibesec gives startup teams a practical way to run regular app security tests, find priority vulnerabilities, and close risks faster.',
    coverage: [
      'Automated checks tailored to common startup web stacks.',
      'Clear findings with severity and actionability context.',
      'Fast remediation guidance to reduce engineering overhead.'
    ],
    audience: ['Founders and early engineering teams.', 'Startups approaching customer security due diligence.', 'Teams with limited dedicated security resources.'],
    faqs: [
      {
        question: 'Can startups run this without a security specialist?',
        answer: 'Yes. The output is designed to be understandable and actionable for product-focused engineers.'
      },
      {
        question: 'Is this enough for compliance on its own?',
        answer: 'It strengthens your security baseline, but formal compliance may require additional controls and evidence.'
      }
    ],
    related: ['ai-security-scanner', 'web-application-security-scanner', 'owasp-top-10-scanner']
  }
];

const staticUrls = [
  { loc: '/', priority: '1.0', changefreq: 'weekly' },
  { loc: '/privacy-policy.html', priority: '0.3', changefreq: 'monthly' },
  { loc: '/terms-and-conditions.html', priority: '0.3', changefreq: 'monthly' },
  { loc: '/seo/index.html', priority: '0.8', changefreq: 'weekly' }
];

const escapeHtml = (value) =>
  value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');

const absoluteUrl = (pathname) => new URL(pathname, SITE_URL).toString();

const baseStyles = `
      :root {
        color-scheme: dark;
      }
      * {
        box-sizing: border-box;
      }
      body {
        margin: 0;
        font-family: Inter, ui-sans-serif, system-ui;
        background: #030712;
        color: #e5e7eb;
      }
      main {
        max-width: 900px;
        margin: 0 auto;
        padding: 44px 24px 70px;
      }
      .pill {
        display: inline-flex;
        border: 1px solid rgba(16, 185, 129, 0.35);
        border-radius: 9999px;
        padding: 6px 10px;
        color: #86efac;
        font-size: 12px;
        text-transform: uppercase;
        letter-spacing: 0.08em;
      }
      h1 {
        font-size: clamp(2rem, 5vw, 3rem);
        margin: 18px 0 12px;
        color: #fff;
      }
      h2 {
        margin: 28px 0 10px;
        color: #fff;
      }
      p,
      li {
        line-height: 1.65;
      }
      section {
        margin-top: 20px;
        border: 1px solid rgba(31, 41, 55, 0.9);
        border-radius: 16px;
        padding: 18px;
        background: rgba(17, 24, 39, 0.45);
      }
      ul {
        margin: 0;
        padding-left: 20px;
      }
      .grid {
        display: grid;
        gap: 14px;
        grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
      }
      .card {
        border: 1px solid rgba(31, 41, 55, 0.9);
        border-radius: 14px;
        padding: 14px;
        background: rgba(2, 6, 23, 0.58);
      }
      .cta {
        display: inline-flex;
        margin-top: 18px;
        padding: 10px 14px;
        border-radius: 10px;
        border: 1px solid #10b981;
        color: #10b981;
        text-decoration: none;
        font-weight: 600;
      }
      a {
        color: #34d399;
      }
      footer {
        margin-top: 38px;
        padding-top: 16px;
        border-top: 1px solid rgba(31, 41, 55, 0.9);
        font-size: 14px;
        color: #94a3b8;
      }
`;

const renderPage = (page) => {
  const pagePath = `/seo/${page.slug}.html`;
  const relatedItems = page.related
    .map((slug) => pages.find((candidate) => candidate.slug === slug))
    .filter(Boolean)
    .map(
      (relatedPage) =>
        `<li><a href="/seo/${relatedPage.slug}.html">${escapeHtml(relatedPage.keyword)}</a></li>`
    )
    .join('');

  const faqEntity = page.faqs.map((item) => ({
    '@type': 'Question',
    name: item.question,
    acceptedAnswer: {
      '@type': 'Answer',
      text: item.answer
    }
  }));

  const jsonLd = [
    {
      '@context': 'https://schema.org',
      '@type': 'WebPage',
      name: page.title,
      description: page.description,
      url: absoluteUrl(pagePath),
      dateModified: TODAY
    },
    {
      '@context': 'https://schema.org',
      '@type': 'SoftwareApplication',
      name: 'Vibesec',
      applicationCategory: 'SecurityApplication',
      operatingSystem: 'Web',
      url: absoluteUrl('/'),
      offers: {
        '@type': 'Offer',
        priceCurrency: 'USD',
        price: '0'
      }
    },
    {
      '@context': 'https://schema.org',
      '@type': 'FAQPage',
      mainEntity: faqEntity
    }
  ];

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>${escapeHtml(page.title)}</title>
    <meta name="description" content="${escapeHtml(page.description)}" />
    <meta name="robots" content="index,follow,max-snippet:-1,max-image-preview:large,max-video-preview:-1" />
    <link rel="canonical" href="${absoluteUrl(pagePath)}" />
    <meta property="og:type" content="article" />
    <meta property="og:site_name" content="Vibesec" />
    <meta property="og:title" content="${escapeHtml(page.title)}" />
    <meta property="og:description" content="${escapeHtml(page.description)}" />
    <meta property="og:url" content="${absoluteUrl(pagePath)}" />
    <meta property="og:image" content="${absoluteUrl('/vibesec-logo.svg')}" />
    <meta name="twitter:card" content="summary_large_image" />
    <meta name="twitter:title" content="${escapeHtml(page.title)}" />
    <meta name="twitter:description" content="${escapeHtml(page.description)}" />
    <meta name="twitter:image" content="${absoluteUrl('/vibesec-logo.svg')}" />
    <script type="application/ld+json">${JSON.stringify(jsonLd)}</script>
    <style>${baseStyles}</style>
  </head>
  <body>
    <main>
      <p class="pill">${escapeHtml(page.keyword)}</p>
      <h1>${escapeHtml(page.h1)}</h1>
      <p>${escapeHtml(page.intro)}</p>

      <section>
        <h2>What This Covers</h2>
        <ul>
          ${page.coverage.map((item) => `<li>${escapeHtml(item)}</li>`).join('')}
        </ul>
      </section>

      <section>
        <h2>Who This Is For</h2>
        <ul>
          ${page.audience.map((item) => `<li>${escapeHtml(item)}</li>`).join('')}
        </ul>
      </section>

      <section>
        <h2>FAQs</h2>
        <div class="grid">
          ${page.faqs
            .map(
              (faq) => `<article class="card">
            <h3>${escapeHtml(faq.question)}</h3>
            <p>${escapeHtml(faq.answer)}</p>
          </article>`
            )
            .join('')}
        </div>
      </section>

      <section>
        <h2>Related Security Topics</h2>
        <ul>${relatedItems}</ul>
      </section>

      <a class="cta" href="/">Start a Security Scan</a>
      <footer>
        <p>Last updated: ${TODAY}</p>
        <p>
          <a href="/seo/index.html">All security pages</a> |
          <a href="/privacy-policy.html">Privacy Policy</a> |
          <a href="/terms-and-conditions.html">Terms and Conditions</a>
        </p>
      </footer>
    </main>
  </body>
</html>
`;
};

const renderHubPage = () => `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Security Scanner Guides and Use Cases | Vibesec</title>
    <meta
      name="description"
      content="Explore Vibesec security scanner guides for OWASP testing, GitHub scanning, DevSecOps workflows, and startup security use cases."
    />
    <meta name="robots" content="index,follow,max-snippet:-1,max-image-preview:large,max-video-preview:-1" />
    <link rel="canonical" href="${absoluteUrl('/seo/index.html')}" />
    <meta property="og:type" content="website" />
    <meta property="og:site_name" content="Vibesec" />
    <meta property="og:title" content="Security Scanner Guides and Use Cases | Vibesec" />
    <meta
      property="og:description"
      content="Browse practical security scanner pages covering common application security workflows and use cases."
    />
    <meta property="og:url" content="${absoluteUrl('/seo/index.html')}" />
    <meta property="og:image" content="${absoluteUrl('/vibesec-logo.svg')}" />
    <style>${baseStyles}</style>
  </head>
  <body>
    <main>
      <p class="pill">Vibesec Resources</p>
      <h1>Security Scanner Guides and Use Cases</h1>
      <p>These pages explain practical security scanning workflows for modern web application teams.</p>
      <section>
        <div class="grid">
          ${pages
            .map(
              (page) => `<article class="card">
            <h2><a href="/seo/${page.slug}.html">${escapeHtml(page.keyword)}</a></h2>
            <p>${escapeHtml(page.description)}</p>
          </article>`
            )
            .join('')}
        </div>
      </section>
      <a class="cta" href="/">Open Vibesec</a>
      <footer>
        <p>Last updated: ${TODAY}</p>
        <p>
          <a href="/privacy-policy.html">Privacy Policy</a> |
          <a href="/terms-and-conditions.html">Terms and Conditions</a>
        </p>
      </footer>
    </main>
  </body>
</html>
`;

const buildSitemap = () => {
  const all = [
    ...staticUrls,
    ...pages.map((page) => ({
      loc: `/seo/${page.slug}.html`,
      priority: '0.8',
      changefreq: 'weekly'
    }))
  ];

  const body = all
    .map(
      (entry) => `  <url>
    <loc>${absoluteUrl(entry.loc)}</loc>
    <lastmod>${TODAY}</lastmod>
    <changefreq>${entry.changefreq}</changefreq>
    <priority>${entry.priority}</priority>
  </url>`
    )
    .join('\n');

  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${body}
</urlset>
`;
};

const run = async () => {
  await mkdir(SEO_DIR, { recursive: true });

  await Promise.all(
    pages.map(async (page) => {
      const outPath = path.join(SEO_DIR, `${page.slug}.html`);
      await writeFile(outPath, renderPage(page), 'utf8');
    })
  );

  await writeFile(path.join(SEO_DIR, 'index.html'), renderHubPage(), 'utf8');
  const sitemapXml = buildSitemap();
  await writeFile(SITEMAP_PATH, sitemapXml, 'utf8');
  await writeFile(SITEMAP_V2_PATH, sitemapXml, 'utf8');

  console.log(`Generated ${pages.length} SEO pages, seo index, sitemap.xml, and sitemap-v2.xml`);
};

run().catch((error) => {
  console.error('Failed to generate SEO pages:', error);
  process.exitCode = 1;
});
