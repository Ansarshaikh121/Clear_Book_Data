create table if not exists ledger_transactions (
  id text not null,
  user_id text not null,
  kind text not null,
  amount_cents integer not null,
  category_id text not null,
  note text not null default '',
  merchant text,
  goal_id text,
  tx_date date not null,
  primary key (user_id, id)
);

create index if not exists ledger_transactions_user_date_idx
  on ledger_transactions (user_id, tx_date);

create table if not exists ledger_goals (
  id text not null,
  user_id text not null,
  name text not null,
  target_cents integer not null,
  icon text not null,
  primary key (user_id, id)
);

create table if not exists ledger_profiles (
  user_id text primary key,
  currency text not null,
  theme text not null,
  month_starts_on integer not null,
  card_order text not null,
  budgets text not null,
  recurring text not null,
  calendar text not null,
  view_month text not null
);
