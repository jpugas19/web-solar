"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

interface Settings {
  [key: string]: string;
}

const BILLING_KEYS = [
  { key: "billing_period_current_start", label: "Mes actual — Inicio", placeholder: "2026-07-11" },
  { key: "billing_period_current_end", label: "Mes actual — Fin", placeholder: "2026-08-11" },
  { key: "billing_period_previous_start", label: "Mes anterior — Inicio", placeholder: "2026-06-10" },
  { key: "billing_period_previous_end", label: "Mes anterior — Fin", placeholder: "2026-07-10" },
];

export default function ConfiguracionPage() {
  const router = useRouter();
  const [settings, setSettings] = useState<Settings>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/settings")
      .then((r) => {
        if (r.status === 401) {
          router.push("/login");
          return;
        }
        return r.json();
      })
      .then((json) => {
        if (!json) return;
        const map: Settings = {};
        for (const s of json.data || []) {
          map[s.key] = s.value;
        }
        setSettings(map);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [router]);

  function handleChange(key: string, value: string) {
    setSettings((prev) => ({ ...prev, [key]: value }));
  }

  async function handleSave() {
    setSaving(true);
    setToast(null);
    try {
      for (const { key } of BILLING_KEYS) {
        await fetch("/api/settings", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ key, value: settings[key] || "" }),
        });
      }
      setToast("Guardado correctamente");
      setTimeout(() => setToast(null), 3000);
    } catch {
      setToast("Error al guardar");
    } finally {
      setSaving(false);
    }
  }

  async function handleLogout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
  }

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-gray-400">Cargando configuración...</div>
      </div>
    );
  }

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
            <button
              onClick={() => router.push("/dashboard")}
              className="rounded-lg bg-gray-800 px-3 py-1.5 text-xs text-gray-300 hover:bg-gray-700"
            >
              Dashboard
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

      <main className="mx-auto max-w-2xl px-4 py-6">
        <h1 className="mb-6 text-lg font-semibold text-gray-200">Configuración</h1>

        {/* Billing Period Section */}
        <div className="rounded-xl border border-gray-800 bg-gray-900 p-6">
          <h2 className="mb-1 text-sm font-medium text-gray-400">Períodos de facturación</h2>
          <p className="mb-4 text-xs text-gray-600">
            Configura los rangos de fechas para los filtros &quot;Mes actual&quot; y &quot;Mes anterior&quot; del dashboard.
          </p>

          <div className="space-y-4">
            {BILLING_KEYS.map(({ key, label, placeholder }) => (
              <div key={key}>
                <label className="mb-1 block text-xs text-gray-500">{label}</label>
                <input
                  type="date"
                  value={settings[key] || ""}
                  placeholder={placeholder}
                  onChange={(e) => handleChange(key, e.target.value)}
                  className="w-full rounded-lg border border-gray-700 bg-gray-800 px-3 py-2 text-sm text-gray-300 focus:border-amber-500 focus:outline-none"
                />
              </div>
            ))}
          </div>

          <div className="mt-6 flex items-center gap-3">
            <button
              onClick={handleSave}
              disabled={saving}
              className="rounded-lg bg-amber-500/20 px-4 py-2 text-sm font-medium text-amber-400 hover:bg-amber-500/30 disabled:opacity-50"
            >
              {saving ? "Guardando..." : "Guardar"}
            </button>
            {toast && (
              <span className={`text-sm ${toast.includes("Error") ? "text-red-400" : "text-green-400"}`}>
                {toast}
              </span>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
