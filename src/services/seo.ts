type JsonLd = Record<string, unknown> | Array<Record<string, unknown>>;

interface SeoConfig {
  title: string;
  description: string;
  path?: string;
  robots?: string;
  imagePath?: string;
  structuredData?: JsonLd;
}

const STRUCTURED_DATA_SCRIPT_ID = 'vibesec-jsonld';

const ensureMetaTag = (attribute: 'name' | 'property', key: string) => {
  const selector = `meta[${attribute}="${key}"]`;
  let element = document.head.querySelector<HTMLMetaElement>(selector);

  if (!element) {
    element = document.createElement('meta');
    element.setAttribute(attribute, key);
    document.head.appendChild(element);
  }

  return element;
};

const ensureCanonical = () => {
  let link = document.head.querySelector<HTMLLinkElement>('link[rel="canonical"]');

  if (!link) {
    link = document.createElement('link');
    link.setAttribute('rel', 'canonical');
    document.head.appendChild(link);
  }

  return link;
};

const setStructuredData = (structuredData?: JsonLd) => {
  const existing = document.getElementById(STRUCTURED_DATA_SCRIPT_ID);
  if (!structuredData) {
    existing?.remove();
    return;
  }

  let script: HTMLScriptElement;
  if (existing instanceof HTMLScriptElement) {
    script = existing;
  } else {
    script = document.createElement('script');
    script.id = STRUCTURED_DATA_SCRIPT_ID;
    script.type = 'application/ld+json';
    document.head.appendChild(script);
  }

  script.textContent = JSON.stringify(structuredData);
};

const toAbsoluteUrl = (path: string) => {
  try {
    return new URL(path, window.location.origin).toString();
  } catch {
    return window.location.origin;
  }
};

export const applySeo = ({
  title,
  description,
  path = '/',
  robots = 'index,follow,max-snippet:-1,max-image-preview:large,max-video-preview:-1',
  imagePath = '/vibesec-logo.svg',
  structuredData
}: SeoConfig) => {
  const canonicalUrl = toAbsoluteUrl(path);
  const socialImageUrl = toAbsoluteUrl(imagePath);

  document.title = title;
  ensureMetaTag('name', 'description').content = description;
  ensureMetaTag('name', 'robots').content = robots;
  ensureMetaTag('property', 'og:type').content = 'website';
  ensureMetaTag('property', 'og:site_name').content = 'Vibesec';
  ensureMetaTag('property', 'og:title').content = title;
  ensureMetaTag('property', 'og:description').content = description;
  ensureMetaTag('property', 'og:url').content = canonicalUrl;
  ensureMetaTag('property', 'og:image').content = socialImageUrl;
  ensureMetaTag('name', 'twitter:card').content = 'summary_large_image';
  ensureMetaTag('name', 'twitter:title').content = title;
  ensureMetaTag('name', 'twitter:description').content = description;
  ensureMetaTag('name', 'twitter:image').content = socialImageUrl;

  ensureCanonical().href = canonicalUrl;
  setStructuredData(structuredData);
};
