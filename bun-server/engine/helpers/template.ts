const COMMON_TOKEN_ALIASES: Record<string, string[]> = {
  firstname: ['first_name', 'firstName', 'firstname'],
  lastname: ['last_name', 'lastName', 'lastname'],
  company: ['company'],
  title: ['title'],
  linkedinurl: ['linkedin_url', 'linkedinUrl', 'url'],
};

function normalizeToken(token: string) {
  return token.replace(/[_\s-]+/g, '').toLowerCase();
}

function readTokenValue(source: Record<string, unknown>, token: string) {
  const normalized = normalizeToken(token);
  const aliases = COMMON_TOKEN_ALIASES[normalized] ?? [token];

  for (const alias of aliases) {
    if (Object.prototype.hasOwnProperty.call(source, alias)) {
      const raw = source[alias];
      return raw == null ? '' : String(raw);
    }
  }

  for (const [key, value] of Object.entries(source)) {
    if (normalizeToken(key) === normalized) {
      return value == null ? '' : String(value);
    }
  }

  return '';
}

export function interpolateTemplate(template: string, payload: Record<string, unknown>) {
  if (!template) return '';

  return template.replace(/\{\{\s*([^}|]+?)\s*(?:\|\s*([^}]+?)\s*)?\}\}/g, (_match, key, fallback) => {
    const resolved = readTokenValue(payload, String(key));
    if (resolved) return resolved;
    return fallback ? String(fallback) : '';
  });
}

