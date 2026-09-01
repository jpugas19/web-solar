"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import StatCard from "@/components/StatCard";
import CanvasFlow from "@/components/CanvasFlow";
import TimeSeriesChart from "@/components/TimeSeriesChart";
import DateFilterBar, { type DateFilter } from "@/components/DateFilterBar";

interface LatestData {
  field_id: string;
  title: string;
  unit: string;
  val: number | null;
  val_text: string | null;
  source: string;
  ts: string;
}

interface ReadingData {
  ts: string;
  val: number | null;
}

function getVal(data: LatestData[], fieldId: string): number | null {
  const item = data.find((d) => d.field_id === fieldId);
  return item?.val ?? null;
}

function getTextVal(data: LatestData[], fieldId: string): string | null {
  const item = data.find((d) => d.field_id === fieldId);
  return item?.val_text ?? null;
}

function formatPower(watts: number | null): string {
  if (watts === null) return "--";
  const abs = Math.abs(watts);
  if (abs >= 1000) return `${(abs / 1000).toFixed(2)} kW`;
  return `${abs.toFixed(0)} W`;
}

function formatEnergy(kwh: number | null): string {
  if (kwh === null) return "--";
  return `${kwh.toFixed(2)} kWh`;
}

function getLoadSource(data: LatestData[]): string {
  const pv = Math.abs(getVal(data, "pv_output_power") || 0);
  const bat = Math.abs(getVal(data, "battery_active_discharging_power") || 0);
  const grid = Math.abs(getVal(data, "grid_active_power") || 0) * 1000;

  if (pv > 20) return "SOLAR";
  if (bat > 20) return "BATERIA";
  if (grid > 20) return "RED";
  return "SIN FUENTE";
}

function getLoadSourceCode(data: LatestData[]): number {
  const src = getLoadSource(data);
  if (src === "SOLAR") return 1;
  if (src === "BATERIA") return 2;
  if (src === "RED") return 3;
  return 0;
}

function getBatMode(data: LatestData[]): number {
  const batPower = getVal(data, "battery_active_power");
  if (batPower === null) return 0;
  if (batPower < -0.02) return 1; // charging
  if (batPower > 0.02) return 2; // discharging
  return 0; // idle
}

function getStatus(data: LatestData[]): number {
  const status = getTextVal(data, "status");
  if (status === "OffGrid") return 1;
  if (status === "Grid-Tie") return 2;
  return 0;
}

export default function DashboardPage() {
  const router = useRouter();
  const [latest, setLatest] = useState<LatestData[]>([]);
  const [seriesData, setSeriesData] = useState<Record<string, ReadingData[]>>({});
  const [loading, setLoading] = useState(true);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);
  const [dateFilter, setDateFilter] = useState<DateFilter>({ mode: "hours", hours: 6 });

  const fetchData = useCallback(async () => {
    try {
      const res = await fetch("/api/latest");
      if (res.status === 401) {
        router.push("/login");
        return;
      }
      const json = await res.json();
      setLatest(json.data || []);
      setLastUpdate(new Date());

      // Fetch key series
      const fields = [
        "pv_output_power",
        "bt_battery_capacity",
        "battery_active_discharging_power",
        "grid_active_sell_power",
        "battery_voltage",
        "battery_current",
        "gd_grid_voltage",
        "pv_voltage",
        "pv_voltage2",
        "ac_temperature",
        "dc_temperature",
        "transformer_temperature",
        "bms_battery_temperature",
        "inverter_power",
        "load_active_power",
      ];

      const seriesPromises = fields.map(async (field) => {
        let url: string;
        if (dateFilter.mode === "hours") {
          url = `/api/readings?field=${field}&hours=${dateFilter.hours}`;
        } else {
          url = `/api/readings?field=${field}&from=${dateFilter.from}&to=${dateFilter.to}T23:59:59Z`;
        }
        const r = await fetch(url);
        const j = await r.json();
        return [field, j.data || []] as const;
      });

      const results = await Promise.all(seriesPromises);
      const newSeries: Record<string, ReadingData[]> = {};
      for (const [field, data] of results) {
        newSeries[field] = data;
      }
      setSeriesData(newSeries);
    } catch (err) {
      console.error("Fetch error:", err);
    } finally {
      setLoading(false);
    }
  }, [router, dateFilter]);

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, dateFilter.mode === "hours" ? 30000 : 60000);
    return () => clearInterval(interval);
  }, [fetchData, dateFilter.mode]);

  async function handleLogout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
  }

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-gray-400">Cargando datos del inversor...</div>
      </div>
    );
  }

  const soc = getVal(latest, "bt_battery_capacity");
  const batteryVoltage = getVal(latest, "battery_voltage");
  const pvPower = getVal(latest, "pv_output_power");
  const inverterPower = getVal(latest, "inverter_power");
  const gridPower = getVal(latest, "grid_active_power");
  const loadPower = getVal(latest, "load_active_power");
  const energyTotal = getVal(latest, "energy_total");
  const energyFromGrid = getVal(latest, "energy_total_from_grid");
  const loadSource = getLoadSource(latest);
  const statusCode = getStatus(latest);
  const statusText =
    statusCode === 1 ? "Off-Grid" : statusCode === 2 ? "Grid-Tie" : "Otro";
  const batMode = getBatMode(latest);

  return (
    <div className="min-h-screen">
      {/* Navbar */}
      <nav className="sticky top-0 z-50 border-b border-gray-800 bg-gray-950/80 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3">
          <div className="flex items-center gap-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-amber-500/20">
              <svg className="h-4 w-4 text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
              </svg>
            </div>
            <span className="font-semibold">Solar Monitor</span>
          </div>
          <div className="flex items-center gap-4">
            {lastUpdate && (
              <span className="text-xs text-gray-500">
                Actualizado: {lastUpdate.toLocaleTimeString("es-CL")}
              </span>
            )}
            <button
              onClick={() => router.push("/configuracion")}
              className="rounded-lg bg-gray-800 px-3 py-1.5 text-xs text-gray-300 hover:bg-gray-700"
            >
              ⚙
            </button>
            <button
              onClick={handleLogout}
              className="rounded-lg bg-gray-800 px-3 py-1.5 text-xs text-gray-300 hover:bg-gray-700"
            >
              Salir
            </button>
          </div>
        </div>
      </nav>

      <main className="mx-auto max-w-7xl px-4 py-6">
        {/* Date Filter */}
        <div className="mb-6">
          <DateFilterBar value={dateFilter} onChange={setDateFilter} />
        </div>

        {/* Stats Row */}
        <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
          <StatCard
            title="Energia total generada"
            value={formatEnergy(energyTotal)}
            color="amber"
          />
          <StatCard
            title="Energia comprada red"
            value={formatEnergy(energyFromGrid)}
            color="cyan"
          />
          <StatCard
            title="SOC actual"
            value={soc !== null ? `${soc.toFixed(1)}%` : "--"}
            color={soc !== null && soc < 15 ? "red" : soc !== null && soc < 40 ? "amber" : "green"}
          />
          <StatCard
            title="Alimentando la carga"
            value={loadSource}
            color={
              loadSource === "SOLAR"
                ? "amber"
                : loadSource === "BATERIA"
                ? "blue"
                : loadSource === "RED"
                ? "cyan"
                : "gray"
            }
          />
        </div>

        {/* Status Row */}
        <div className="mb-6 grid grid-cols-2 gap-4">
          <StatCard
            title="Estado actual"
            value={statusText}
            color={statusCode === 1 ? "green" : statusCode === 2 ? "cyan" : "amber"}
          />
          <StatCard
            title="Voltaje bateria"
            value={batteryVoltage !== null ? `${batteryVoltage.toFixed(1)} V` : "--"}
            color="blue"
          />
        </div>

        {/* Canvas Flow */}
        <div className="mb-6 rounded-xl border border-gray-800 bg-gray-900 p-6">
          <h2 className="mb-4 text-sm font-medium text-gray-400">Flujo de energia</h2>
          <CanvasFlow
            pvPower={pvPower}
            inverterPower={inverterPower}
            loadPower={loadPower}
            gridPower={gridPower}
            batteryVoltage={batteryVoltage}
            soc={soc}
            batMode={batMode}
            loadMode={getLoadSourceCode(latest)}
            gridSupply={gridPower !== null && Math.abs(gridPower) > 0.02 ? 1 : 0}
            pvGen={pvPower !== null && pvPower > 20 ? 1 : 0}
          />
        </div>

        {/* Charts */}
        <div className="mb-6 grid grid-cols-1 gap-4 lg:grid-cols-2">
          <TimeSeriesChart
            title="PV Output Power"
            data={seriesData.pv_output_power || []}
            unit="W"
            color="#f59e0b"
            multiDay={dateFilter.mode !== "hours"}
          />
          <TimeSeriesChart
            title="Battery SOC"
            data={seriesData.bt_battery_capacity || []}
            unit="%"
            color="#22c55e"
            multiDay={dateFilter.mode !== "hours"}
          />
        </div>

        <div className="mb-6 grid grid-cols-1 gap-4 lg:grid-cols-2">
          <TimeSeriesChart
            title="Flujo de carga"
            data={seriesData.load_active_power || []}
            unit="W"
            color="#3b82f6"
            multiDay={dateFilter.mode !== "hours"}
            extraSeries={[
              { data: seriesData.battery_active_discharging_power || [], color: "#22c55e", name: "Bateria" },
              { data: seriesData.grid_active_sell_power || [], color: "#06b6d4", name: "Red" },
            ]}
          />
          <TimeSeriesChart
            title="Battery Voltage"
            data={seriesData.battery_voltage || []}
            unit="V"
            color="#3b82f6"
            multiDay={dateFilter.mode !== "hours"}
          />
        </div>

        <div className="mb-6 grid grid-cols-1 gap-4 lg:grid-cols-2">
          <TimeSeriesChart
            title="MPPT Voltages"
            data={seriesData.pv_voltage || []}
            unit="V"
            color="#f59e0b"
            multiDay={dateFilter.mode !== "hours"}
            extraSeries={[
              { data: seriesData.pv_voltage2 || [], color: "#fb923c", name: "PV2" },
            ]}
          />
          <TimeSeriesChart
            title="Temperaturas"
            data={seriesData.ac_temperature || []}
            unit="°C"
            color="#ef4444"
            multiDay={dateFilter.mode !== "hours"}
            extraSeries={[
              { data: seriesData.dc_temperature || [], color: "#f97316", name: "DC" },
              { data: seriesData.transformer_temperature || [], color: "#a855f7", name: "Transf" },
              { data: seriesData.bms_battery_temperature || [], color: "#22c55e", name: "BMS" },
            ]}
          />
        </div>
      </main>
    </div>
  );
}
