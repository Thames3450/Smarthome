import { createClient } from 'jsr:@supabase/supabase-js@2';
export const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, apikey, content-type, x-device-token, x-cron-secret',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Content-Type': 'application/json',
};
export const respond = (data: unknown, status = 200) => new Response(JSON.stringify(data), { status, headers: cors });
export function preflight(request: Request) { return request.method === 'OPTIONS' ? new Response(null, { headers: cors }) : null; }
export function admin() {
  const url = Deno.env.get('SUPABASE_URL')!;
  const key = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  if (!url || !key) throw new Error('Supabase environment is not configured');
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}
export async function sha256(value: string) {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest), b => b.toString(16).padStart(2, '0')).join('');
}
export function randomHex(bytes: number) {
  const buffer = crypto.getRandomValues(new Uint8Array(bytes));
  return Array.from(buffer, b => b.toString(16).padStart(2, '0')).join('');
}
export async function currentUser(req: Request) {
  const token = req.headers.get('authorization')?.match(/^Bearer\s+(.+)$/i)?.[1];
  if (!token) return null;
  const { data, error } = await admin().auth.getUser(token);
  return error ? null : data.user;
}
export const errMessage = (error: unknown) => error instanceof Error ? error.message : String(error);
