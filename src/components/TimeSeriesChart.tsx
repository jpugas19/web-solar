"use client";

import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";

interface DataPoint {
  ts: string;
  val: number | null;
}

interface ExtraSeries {
  data: DataPoint[];
  color: string;
  name: string;
}

interface TimeSeriesChartProps {
  title: string;
  data: DataPoint[];
  unit: string;
  color: string;
  extraSeries?: ExtraSeries[];
  multiDay?: boolean;
}

function formatTime(ts: string, multiDay?: boolean): string {
  const d = new Date(ts);
  if (multiDay) {
    return d.toLocaleDateString("es-CL", { day: "2-digit", month: "2-digit" }) + " " +
      d.toLocaleTimeString("es-CL", { hour: "2-digit", minute: "2-digit" });
  }
  return d.toLocaleTimeString("es-CL", { hour: "2-digit", minute: "2-digit" });
}

function mergeData(
  primary: DataPoint[],
  extras: ExtraSeries[]
): Array<Record<string, number | string | null>> {
  const map = new Map<string, Record<string, number | string | null>>();

  for (const p of primary) {
    const key = p.ts;
    if (!map.has(key)) map.set(key, { ts: p.ts });
    map.get(key)!.val = p.val;
  }

  for (const extra of extras) {
    for (const p of extra.data) {
      const key = p.ts;
      if (!map.has(key)) map.set(key, { ts: p.ts });
      map.get(key)![extra.name] = p.val;
    }
  }

  return Array.from(map.values()).sort(
    (a, b) => new Date(a.ts as string).getTime() - new Date(b.ts as string).getTime()
  );
}

export default function TimeSeriesChart({
  title,
  data,
  unit,
  color,
  extraSeries = [],
  multiDay = false,
}: TimeSeriesChartProps) {
  const chartData = mergeData(data, extraSeries);

  return (
    <div className="rounded-xl border border-gray-800 bg-gray-900 p-4">
      <div className="mb-2 text-sm font-medium text-gray-400">{title}</div>
      <div className="h-48">
        {chartData.length === 0 ? (
          <div className="flex h-full items-center justify-center text-gray-600">
            Sin datos
          </div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
              <XAxis
                dataKey="ts"
                tickFormatter={(ts) => formatTime(ts, multiDay)}
                stroke="#4b5563"
                fontSize={10}
                tickLine={false}
              />
              <YAxis stroke="#4b5563" fontSize={10} tickLine={false} />
              <Tooltip
                contentStyle={{
                  backgroundColor: "#111827",
                  border: "1px solid #374151",
                  borderRadius: "8px",
                  fontSize: "12px",
                }}
                labelFormatter={(label) => formatTime(String(label), multiDay)}
                formatter={(value, name) => [
                  value != null ? `${Number(value).toFixed(1)} ${unit}` : "--",
                  name === "val" ? title : String(name),
                ]}
              />
              <Line
                type="monotone"
                dataKey="val"
                stroke={color}
                strokeWidth={2}
                dot={false}
                name={title}
              />
              {extraSeries.map((extra) => (
                <Line
                  key={extra.name}
                  type="monotone"
                  dataKey={extra.name}
                  stroke={extra.color}
                  strokeWidth={1.5}
                  dot={false}
                  strokeDasharray={extra.name === "Bateria" ? "5 5" : undefined}
                />
              ))}
              <Legend
                wrapperStyle={{ fontSize: "10px", color: "#9ca3af" }}
              />
            </LineChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
}
