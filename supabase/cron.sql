-- Run AFTER 100_infra.sql, enabling extensions, deploying scheduler with
-- verify_jwt=false and provisioning the two Vault secrets described in README.
-- Idempotent: cron.schedule updates the existing named job.
do $$ begin
  if not exists (select 1 from vault.decrypted_secrets where name = 'scheduler_project_url')
    or not exists (select 1 from vault.decrypted_secrets where name = 'scheduler_cron_secret')
  then raise exception 'Provision scheduler_project_url and scheduler_cron_secret in Vault first'; end if;
end $$;
select cron.schedule('couple-app-scheduler', '* * * * *', $cron$
  select net.http_post(
    url := (select decrypted_secret from vault.decrypted_secrets where name = 'scheduler_project_url') || '/functions/v1/scheduler',
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-cron-secret',
      (select decrypted_secret from vault.decrypted_secrets where name = 'scheduler_cron_secret')),
    body := '{}'::jsonb,
    timeout_milliseconds := 60000
  );
$cron$);
