import { useState } from "react";
import { Bar, BarChart, CartesianGrid, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { formatCompactMoney, formatDay, formatMoney, type CurrencyCode, type DaySpend, type SpendSlice } from "@/lib/budget/model";

export type ChartSlice = SpendSlice & { fill: string };

type SpendChartProps = {
  slices: ChartSlice[];
  total: number;
  currency: CurrencyCode;
  onSelect?: (categoryId: string) => void;
};

type TipPayload = {
  payload?: ChartSlice;
};

function prefersReducedMotion() {
  return typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

function ChartTip({
  active,
  payload,
  currency,
}: {
  active?: boolean;
  payload?: TipPayload[];
  currency: CurrencyCode;
}) {
  const row = payload?.[0]?.payload;
  if (!active || !row) return null;
  return (
    <div className="rounded-md bg-foreground px-3 py-2 text-sm text-background shadow-card">
      <p>{row.label}</p>
      <p className="font-medium tabular-nums">{formatMoney(row.cents, currency)}</p>
    </div>
  );
}

export function SpendChart({ slices, total, currency, onSelect }: SpendChartProps) {
  const reduceMotion = prefersReducedMotion();

  return (
    <div className="relative mx-auto h-44 w-full max-w-xs">
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie
            data={slices}
            dataKey="cents"
            nameKey="label"
            innerRadius="64%"
            outerRadius="88%"
            paddingAngle={slices.length > 1 ? 2 : 0}
            stroke="none"
            isAnimationActive={!reduceMotion}
            animationDuration={600}
            animationEasing="ease-out"
            onClick={(slice) => {
              const id = (slice as { categoryId?: string }).categoryId;
              if (id && id !== "other") onSelect?.(id);
            }}
          >
            {slices.map((slice) => (
              <Cell key={slice.categoryId} fill={slice.fill} />
            ))}
          </Pie>
          <Tooltip content={<ChartTip currency={currency} />} />
        </PieChart>
      </ResponsiveContainer>
      <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center px-10 text-center">
        <span className="text-xs text-muted-foreground">Spent</span>
        <span className="figure-center text-foreground">{formatMoney(total, currency)}</span>
      </div>
    </div>
  );
}

type DailyProps = {
  points: DaySpend[];
  currency: CurrencyCode;
  onSelect?: (date: string) => void;
};

export function DailySpendChart({ points, currency, onSelect }: DailyProps) {
  const reduceMotion = prefersReducedMotion();
  const [picked, setPicked] = useState<DaySpend | null>(null);
  const active = picked ?? points.find((point) => point.cents > 0) ?? null;

  return (
    <div>
      <div className="h-48 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={points} margin={{ top: 8, right: 4, left: 0, bottom: 0 }}>
            <CartesianGrid vertical={false} stroke="var(--color-border)" />
            <XAxis
              dataKey="day"
              tick={{ fill: "var(--color-muted-foreground)", fontSize: 11 }}
              axisLine={false}
              tickLine={false}
              interval={6}
            />
            <YAxis
              width={52}
              tick={{ fill: "var(--color-muted-foreground)", fontSize: 11 }}
              axisLine={false}
              tickLine={false}
              tickFormatter={(value: number) => formatCompactMoney(value, currency)}
            />
            <Tooltip cursor={{ fill: "var(--color-muted)" }} content={() => null} />
            <Bar
              dataKey="cents"
              fill="var(--color-negative)"
              radius={[3, 3, 0, 0]}
              maxBarSize={16}
              isAnimationActive={!reduceMotion}
              animationDuration={600}
              animationEasing="ease-out"
              onMouseEnter={(bar) => {
                const point = bar?.payload as DaySpend | undefined;
                if (point) setPicked(point);
              }}
              onClick={(bar) => {
                const point = bar?.payload as DaySpend | undefined;
                if (!point) return;
                setPicked(point);
                onSelect?.(point.date);
              }}
            />
          </BarChart>
        </ResponsiveContainer>
      </div>
      <p className="mt-2 min-h-10 rounded-md bg-muted px-3 py-2 text-sm" role="status">
        {active ? (
          <>
            <span className="font-medium">{formatDay(active.date)}</span>
            <span className="text-muted-foreground"> · </span>
            <span className="font-medium tabular-nums">
              {active.cents > 0
                ? `${formatMoney(active.cents, currency)} · ${active.count} transaction${active.count === 1 ? "" : "s"}`
                : "No spending recorded"}
            </span>
          </>
        ) : (
          <span className="text-muted-foreground">Hover or tap a day.</span>
        )}
      </p>
    </div>
  );
}
