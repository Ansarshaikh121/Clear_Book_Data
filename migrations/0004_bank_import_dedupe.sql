-- Prevent concurrent/repeated imports of the same bank entry for one account.
-- Manual entries remain unaffected; the import handler checks them separately.
create unique index if not exists ledger_bank_import_identity_idx
on ledger_transactions (user_id, tx_date, kind, amount_cents, lower(trim(note)))
where id like 'bank-%';
