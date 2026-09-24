alter table ledger_transactions add column if not exists splits text;
alter table ledger_transactions add column if not exists refund_of text;
alter table ledger_transactions add column if not exists spending_class text;
alter table ledger_transactions add column if not exists collection_name text;
alter table ledger_transactions add column if not exists collection_kind text;
alter table ledger_transactions add column if not exists created_at timestamptz;

create table if not exists ledger_export_log (
  id text primary key,
  user_id text not null,
  exported_at timestamptz not null default now(),
  range_type text not null,
  range_start date,
  range_end date,
  sections text not null
);

create index if not exists ledger_export_log_user_idx
  on ledger_export_log (user_id, exported_at);
