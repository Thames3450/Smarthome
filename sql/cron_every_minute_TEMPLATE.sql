-- AFTER deploying run-automations. Replace placeholders with your NEW Home Thames project,
-- do not put any of these secrets into config.js / firmware / public Git repository.
-- Recommended: in Supabase Dashboard enable pg_cron and pg_net extensions first.
create extension if not exists pg_cron with schema pg_catalog;
create extension if not exists pg_net with schema extensions;

-- Run each create_secret ONLY ONCE. Match CRON_SECRET in Edge Function secrets.
select vault.create_secret('https://YOUR_HOME THAMES_REF.supabase.co','homiq_url');
select vault.create_secret('YOUR_PUBLIC_PUBLISHABLE_KEY','homiq_publishable_key');
select vault.create_secret('GENERATE_A_RANDOM_SECRET_32_PLUS_CHARACTERS','homiq_cron_secret');

-- Schedule every minute. Automations require this job; a server cannot run by itself.
select cron.schedule('homiq-automation-minute', '* * * * *',
$$
select net.http_post(
 url:=(select decrypted_secret from vault.decrypted_secrets where name='homiq_url') || '/functions/v1/run-automations',
 headers:=jsonb_build_object(
  'Content-Type','application/json',
  'apikey',(select decrypted_secret from vault.decrypted_secrets where name='homiq_publishable_key'),
  'x-cron-secret',(select decrypted_secret from vault.decrypted_secrets where name='homiq_cron_secret')
 ),
 body:='{}'::jsonb,
 timeout_milliseconds:=10000
);
$$);
-- Check in Supabase -> Integrations -> Cron and monitor job run errors.
