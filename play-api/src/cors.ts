import type { Env } from './env.ts';

const ALLOWED_METHODS = 'GET, POST, OPTIONS';
const PREFLIGHT_MAX_AGE_S = '600';

export function allowedOrigins(env: Env): ReadonlySet<string> {
  return new Set(
    env.ALLOWED_ORIGINS.split(',')
      .map((origin) => origin.trim())
      .filter(Boolean),
  );
}

/** CORS headers for an allowed Origin; nothing for any other, so the browser blocks the read. */
export function corsHeaders(origin: string | null, allowed: ReadonlySet<string>): Record<string, string> {
  const base = { Vary: 'Origin' };
  return origin && allowed.has(origin) ? { ...base, 'Access-Control-Allow-Origin': origin } : base;
}

export function preflight(request: Request, allowed: ReadonlySet<string>): Response {
  const origin = request.headers.get('Origin');
  const isForeignOrigin = !origin || !allowed.has(origin);
  if (isForeignOrigin) return new Response(null, { status: 403, headers: { Vary: 'Origin' } });
  return new Response(null, {
    status: 204,
    headers: {
      ...corsHeaders(origin, allowed),
      'Access-Control-Allow-Methods': ALLOWED_METHODS,
      'Access-Control-Allow-Headers': 'Content-Type',
      'Access-Control-Max-Age': PREFLIGHT_MAX_AGE_S,
    },
  });
}
