import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const DEFAULT_ALLOWED_ORIGINS = [
  'https://www.ajynworld.com',
  'https://ajynworld.com',
  'http://localhost:8080',
  'http://127.0.0.1:8080',
];

function getAllowedOrigins() {
  const configured = Deno.env.get('APP_ALLOWED_ORIGINS');
  if (!configured) {
    return DEFAULT_ALLOWED_ORIGINS;
  }

  return configured
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean);
}

export function getCorsHeaders(req?: Request) {
  const allowedOrigins = getAllowedOrigins();
  const origin = req?.headers.get('Origin') || '';
  const allowOrigin = allowedOrigins.includes(origin) ? origin : allowedOrigins[0];

  return {
    'Access-Control-Allow-Origin': allowOrigin,
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-internal-automation-key',
    'Vary': 'Origin',
  };
}

export type ServiceSupabaseClient = ReturnType<typeof createClient>;

export interface RequestActor {
  id: string;
  email?: string | null;
}

export function createServiceSupabaseClient() {
  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error('Supabase service configuration is missing');
  }

  return createClient(supabaseUrl, serviceRoleKey);
}

export function jsonResponse(body: Record<string, unknown>, status = 200, req?: Request) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...getCorsHeaders(req),
      'Content-Type': 'application/json',
    },
  });
}

export function getBearerToken(req: Request) {
  const authHeader = req.headers.get('Authorization');
  if (!authHeader) return null;

  const [, token] = authHeader.match(/^Bearer\s+(.+)$/i) || [];
  return token || null;
}

export function getApiKey(req: Request) {
  return req.headers.get('apikey');
}

export function isInternalAutomationRequest(req: Request) {
  const configuredKey = Deno.env.get('INTERNAL_AUTOMATIONS_KEY');
  if (!configuredKey) {
    return false;
  }

  const providedKey =
    req.headers.get('x-internal-automation-key') ||
    getBearerToken(req) ||
    getApiKey(req);

  return providedKey === configuredKey;
}

export async function getRequestActor(
  req: Request,
  supabase: ServiceSupabaseClient,
): Promise<RequestActor | null> {
  const accessToken = getBearerToken(req);
  if (!accessToken || isInternalAutomationRequest(req)) {
    return null;
  }

  const {
    data: { user },
    error,
  } = await supabase.auth.getUser(accessToken);

  if (error || !user) {
    return null;
  }

  return {
    id: user.id,
    email: user.email,
  };
}

export async function getRequestActorRole(
  supabase: ServiceSupabaseClient,
  actorId: string,
) {
  const { data, error } = await supabase
    .from('user_roles')
    .select('role')
    .eq('user_id', actorId)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return data?.role || null;
}

export async function requireAuthenticatedActor(
  req: Request,
  supabase: ServiceSupabaseClient,
) {
  const actor = await getRequestActor(req, supabase);
  if (!actor) {
    return {
      actor: null,
      errorResponse: jsonResponse({ error: 'Authentication required' }, 401, req),
    };
  }

  return { actor, errorResponse: null };
}

export async function requireAdminOrInternalRequest(
  req: Request,
  supabase: ServiceSupabaseClient,
) {
  if (isInternalAutomationRequest(req)) {
    return { actor: null, isInternal: true, errorResponse: null };
  }

  const actor = await getRequestActor(req, supabase);
  if (!actor) {
    return {
      actor: null,
      isInternal: false,
      errorResponse: jsonResponse({ error: 'Authentication required' }, 401, req),
    };
  }

  const actorRole = await getRequestActorRole(supabase, actor.id);
  if (actorRole !== 'admin' && actorRole !== 'manager') {
    return {
      actor: null,
      isInternal: false,
      errorResponse: jsonResponse({ error: 'Admin or manager access required' }, 403, req),
    };
  }

  return { actor, isInternal: false, errorResponse: null };
}
