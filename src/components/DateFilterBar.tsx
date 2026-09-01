"use client";

import { useEffect, useState } from "react";

export type DateFilter =
  | { mode: "hours"; hours: number }
  | { mode: "billing"; label: string; from: string; to: string }
  | { mode: "custom"; from: string; to: string };

interface BillingPeriod {
  start: string;
  end: string;
  label: string;
}

interface DateFilterBarProps {
  value: DateFilter;
  onChange: (filter: DateFilter) => void;
}

function toDateString(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function today(): string {
  return toDateString(new Date());
}

export default function DateFilterBar({ value, onChange }: DateFilterBarProps) {
  const [currentPeriod, setCurrentPeriod] = useState<BillingPeriod | null>(null);
  const [previousPeriod, setPreviousPeriod] = useState<BillingPeriod | null>(null);
  const [customFrom, setCustomFrom] = useState(today());
  const [customTo, setCustomTo] = useState(today());

  useEffect(() => {
    fetch("/api/settings")
      .then((r) => r.json())
      .then((json) => {
        const settings: Record<string, string> = {};
        for (const s of json.data || []) {
          settings[s.key] = s.value;
        }
        if (settings.billing_period_current_start && settings.billing_period_current_end) {
          setCurrentPeriod({
            start: settings.billing_period_current_start,
            end: settings.billing_period_current_end,
            label: "Mes actual",
          });
        }
        if (settings.billing_period_previous_start && settings.billing_period_previous_end) {
          setPreviousPeriod({
            start: settings.billing_period_previous_start,
            end: settings.billing_period_previous_end,
            label: "Mes anterior",
          });
        }
      })
      .catch(() => {});
  }, []);

  const presets: { label: string; filter: DateFilter }[] = [
    { label: "6h", filter: { mode: "hours", hours: 6 } },
    { label: "24h", filter: { mode: "hours", hours: 24 } },
  ];

  if (currentPeriod) {
    presets.push({
      label: currentPeriod.label,
      filter: {
        mode: "billing",
        label: currentPeriod.label,
        from: currentPeriod.start,
        to: currentPeriod.end,
      },
    });
  }

  if (previousPeriod) {
    presets.push({
      label: previousPeriod.label,
      filter: {
        mode: "billing",
        label: previousPeriod.label,
        from: previousPeriod.start,
        to: previousPeriod.end,
      },
    });
  }

  const isCustomMode = value.mode === "custom";

  function handleCustomApply() {
    onChange({ mode: "custom", from: customFrom, to: customTo });
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="text-xs text-gray-500">Período:</span>
      {presets.map((p) => {
        const isActive =
          value.mode === p.filter.mode &&
          ((value.mode === "hours" && p.filter.mode === "hours" && value.hours === p.filter.hours) ||
            (value.mode === "billing" &&
              p.filter.mode === "billing" &&
              value.from === p.filter.from &&
              value.to === p.filter.to));
        return (
          <button
            key={p.label}
            onClick={() => onChange(p.filter)}
            className={`rounded-lg px-3 py-1.5 text-xs font-medium transition ${
              isActive
                ? "bg-amber-500/20 text-amber-400"
                : "bg-gray-800 text-gray-400 hover:bg-gray-700 hover:text-gray-300"
            }`}
          >
            {p.label}
          </button>
        );
      })}
      <div className="flex items-center gap-1.5">
        <button
          onClick={() => {
            if (!isCustomMode) {
              setCustomFrom(today());
              setCustomTo(today());
              onChange({ mode: "custom", from: today(), to: today() });
            }
          }}
          className={`rounded-lg px-3 py-1.5 text-xs font-medium transition ${
            isCustomMode
              ? "bg-amber-500/20 text-amber-400"
              : "bg-gray-800 text-gray-400 hover:bg-gray-700 hover:text-gray-300"
          }`}
        >
          Rango
        </button>
        {isCustomMode && (
          <>
            <input
              type="date"
              value={customFrom}
              onChange={(e) => setCustomFrom(e.target.value)}
              className="rounded-lg border border-gray-700 bg-gray-800 px-2 py-1 text-xs text-gray-300 focus:border-amber-500 focus:outline-none"
            />
            <span className="text-xs text-gray-600">a</span>
            <input
              type="date"
              value={customTo}
              onChange={(e) => setCustomTo(e.target.value)}
              className="rounded-lg border border-gray-700 bg-gray-800 px-2 py-1 text-xs text-gray-300 focus:border-amber-500 focus:outline-none"
            />
            <button
              onClick={handleCustomApply}
              className="rounded-lg bg-amber-500/20 px-2 py-1 text-xs text-amber-400 hover:bg-amber-500/30"
            >
              OK
            </button>
          </>
        )}
      </div>
    </div>
  );
}
