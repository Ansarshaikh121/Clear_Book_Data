import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { buildCalendarIcs, type CalendarExportOptions } from "@/lib/budget/calendar-ics";
import { getCalendarCapability, type CalendarCapability } from "@/lib/budget/calendar-capability";
import { ledgerRequestSignal, useBudget } from "@/lib/budget/store";

const FALLBACK: CalendarCapability = {
  connected: false,
  lastSync: null,
  calendarWriteAvailable: false,
};

export function CalendarCard() {
  const transactions = useBudget((state) => state.transactions);
  const recurring = useBudget((state) => state.settings.recurring);
  const currency = useBudget((state) => state.currency);
  const calendar = useBudget((state) => state.settings.calendar);
  const patchSettings = useBudget((state) => state.patchSettings);
  const [origin, setOrigin] = useState("");
  const [capability, setCapability] = useState<CalendarCapability | null>(null);
  const [checkFailed, setCheckFailed] = useState(false);
  const [downloaded, setDownloaded] = useState(false);

  useEffect(() => {
    let live = true;
    void getCalendarCapability({ signal: ledgerRequestSignal() })
      .then((result) => {
        if (live) setCapability(result);
      })
      .catch(() => {
        if (live) setCheckFailed(true);
      });
    setOrigin(window.location.origin);
    return () => {
      live = false;
    };
  }, []);

  const timeZone = calendar.timeZone || Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
  const startDate = calendar.startDate || firstOfMonth();
  const options: CalendarExportOptions = {
    ...calendar,
    startDate,
    timeZone,
    currency,
    origin,
    reminderFrequency: calendar.reminderFrequency,
  };
  const built = useMemo(
    () => buildCalendarIcs(transactions, recurring, options),
    [transactions, recurring, options.mode, options.startDate, options.includeAmount, options.includeMerchant, options.includeCategory, options.includeNotes, options.includeReminders, options.reminderTime, options.reminderOffsetDays, options.reminderFrequency, options.timeZone, options.currency, options.origin],
  );
  const sample = built.events[0];
  const status = capability ?? (checkFailed ? FALLBACK : null);

  function patch(partial: Partial<typeof calendar>) {
    patchSettings({ calendar: { ...calendar, ...partial } });
    setDownloaded(false);
  }

  function download() {
    const file = new Blob([built.ics], { type: "text/calendar;charset=utf-8" });
    const url = URL.createObjectURL(file);
    const link = document.createElement("a");
    link.href = url;
    link.download = "clearbook.ics";
    link.click();
    URL.revokeObjectURL(url);
    setDownloaded(true);
  }

  return (
    <section className="panel p-4" id="integrations" aria-labelledby="integrations-heading">
      <p className="text-sm text-muted-foreground">Integrations</p>
      <h3 id="integrations-heading" className="mt-1 text-lg font-medium">Google Calendar</h3>
      <p className="mt-1 text-sm text-muted-foreground">
        A dedicated Clearbook calendar is not connected. Your ledger stays in your account, not in Google.
      </p>
      <div className="mt-4 grid gap-3 sm:grid-cols-3">
        <Status label="Connection" value={status ? "Not connected" : "Checking…"} />
        <Status label="Last successful sync" value="None" />
        <Status label="State" value="Needs Attention" />
      </div>
      <div className="mt-4 flex flex-wrap gap-2">
        <Button disabled>Connect Google Calendar</Button>
        <Button variant="secondary" disabled>Sync Now</Button>
        <Button variant="ghost" disabled>Disconnect</Button>
      </div>
      <p className="mt-3 text-sm text-muted-foreground">
        Connect, Sync Now, and Disconnect stay off. Google has not confirmed a calendar for this account, so there is nothing to revoke and no Open in Google Calendar link.
      </p>

      <div className="mt-6 border-t border-border pt-4">
        <h4 className="text-base font-medium">Export only — does not stay synced</h4>
        <p className="mt-1 text-sm text-muted-foreground">
          Download a calendar file you can import yourself. Clearbook stays the source of truth. Edits in Google Calendar do not update the ledger, and importing again does not delete old events. Each expense is included once. Savings transfers are not expenses. No guests are added.
        </p>
        <fieldset className="mt-4">
          <legend className="text-sm font-medium">Expense mode</legend>
          <div className="mt-2 grid gap-2 sm:grid-cols-2">
            <label className="flex gap-2 rounded-md bg-muted p-3 text-sm">
              <input type="radio" name="calendar-mode" checked={calendar.mode === "daily"} onChange={() => patch({ mode: "daily" })} />
              <span>Daily Summary, recommended. One all-day event per date, titled Daily Spending.</span>
            </label>
            <label className="flex gap-2 rounded-md bg-muted p-3 text-sm">
              <input type="radio" name="calendar-mode" checked={calendar.mode === "individual"} onChange={() => patch({ mode: "individual" })} />
              <span>Individual Expenses. One all-day event per expense. Private notes stay out unless you include them.</span>
            </label>
          </div>
        </fieldset>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <label className="grid gap-1 text-sm">
            Sync start date
            <input className="field" type="date" value={startDate} onChange={(event) => patch({ startDate: event.target.value })} />
          </label>
          <label className="grid gap-1 text-sm">
            Timezone
            <input className="field" value={timeZone} onChange={(event) => patch({ timeZone: event.target.value })} />
          </label>
          <label className="grid gap-1 text-sm">
            Reminder time
            <input className="field" type="time" value={calendar.reminderTime} onChange={(event) => patch({ reminderTime: event.target.value || "09:00" })} />
          </label>
          <label className="grid gap-1 text-sm">
            Repetition
            <select className="field" value={calendar.reminderFrequency} onChange={(event) => patch({ reminderFrequency: event.target.value as typeof calendar.reminderFrequency })}>
              <option value="monthly">Monthly</option>
              <option value="weekly">Weekly</option>
              <option value="yearly">Yearly</option>
            </select>
          </label>
          <label className="grid gap-1 text-sm sm:col-span-2">
            Reminder offset
            <select
              className="field"
              value={String(calendar.reminderOffsetDays)}
              onChange={(event) => patch({ reminderOffsetDays: Number(event.target.value) as 0 | 1 | 2 })}
            >
              <option value="0">At the reminder time</option>
              <option value="1">One day before</option>
              <option value="2">Two days before</option>
            </select>
          </label>
        </div>
        <fieldset className="mt-4">
          <legend className="text-sm font-medium">What the file may include</legend>
          <div className="mt-2 grid gap-2 text-sm sm:grid-cols-2">
            <Check label="Amounts" checked={calendar.includeAmount} onChange={(includeAmount) => patch({ includeAmount })} />
            <Check label="Merchant names" checked={calendar.includeMerchant} onChange={(includeMerchant) => patch({ includeMerchant })} />
            <Check label="Category details" checked={calendar.includeCategory} onChange={(includeCategory) => patch({ includeCategory })} />
            <Check label="Private notes" checked={calendar.includeNotes} onChange={(includeNotes) => patch({ includeNotes })} />
            <Check label="Confirmed upcoming payments" checked={calendar.includeReminders} onChange={(includeReminders) => patch({ includeReminders })} />
          </div>
          <p className="mt-2 text-xs text-muted-foreground">
            Titles stay generic until you enable a detail. Amounts can appear in Google notifications if you turn them on. Events are marked private and do not block availability. A scheduled payment is not an expense. If you already recorded that payment, its reminder date is skipped so it is not counted twice.
          </p>
        </fieldset>
        <div className="mt-4 rounded-md border border-border p-3">
          <p className="text-sm font-medium">Preview</p>
          {sample ? (
            <>
              <p className="mt-2 text-sm">{sample.title}</p>
              <p className="mt-1 whitespace-pre-wrap text-sm text-muted-foreground">{sample.description}</p>
              <p className="mt-2 text-xs text-muted-foreground">{built.events.length} event{built.events.length === 1 ? "" : "s"} from {startDate}. This preview is not uploaded.</p>
            </>
          ) : (
            <p className="mt-2 text-sm text-muted-foreground">No events match this start date. Change the date or add a transaction before exporting.</p>
          )}
        </div>
        <Button className="mt-4" onClick={download} disabled={built.events.length === 0}>
          Download calendar file
        </Button>
        {downloaded ? (
          <p className="mt-2 text-sm" role="status">
            File downloaded. Export only — does not stay synced. Google has not confirmed a connection.
          </p>
        ) : null}
      </div>
    </section>
  );
}

function Status({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md bg-muted px-3 py-2">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-sm font-medium">{value}</p>
    </div>
  );
}

function Check({ label, checked, onChange }: { label: string; checked: boolean; onChange: (value: boolean) => void }) {
  return (
    <label className="flex h-11 items-center gap-2">
      <input type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} />
      {label}
    </label>
  );
}

function firstOfMonth(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`;
}
