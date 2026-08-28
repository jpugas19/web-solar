# PLAN: web-solar — Monitor Solar Web

## Estado general

| # | Paso | Estado | Notas |
|---|------|--------|-------|
| 1 | Setup proyecto Next.js + deps | ✅ Listo | Next.js 16.3.3 + Neon + Recharts + jose + bcryptjs + tsx |
| 2 | DB schema + seed user en Neon | ⏳ Pendiente | |
| 3 | Auth (lib + middleware + login) | ✅ Listo | JWT jose + middleware + API routes |
| 4 | ValueClouds API client TS | ✅ Listo | valueclouds.ts + flatten functions |
| 5 | API capture (Edge Function) | ✅ Listo | /api/capture, runtime=edge |
| 6 | API readings/latest | ✅ Listo | /api/readings, /api/latest |
| 7 | Dashboard UI + StatCards | ✅ Listo | layout + page + StatCard |
| 8 | Canvas SVG flujo energía | ✅ Listo | CanvasFlow.tsx |
| 9 | Charts (Recharts) | ✅ Listo | TimeSeriesChart.tsx |
| 10 | Alertas + Telegram | ✅ Listo | alerts.ts + /api/alerts |
| 11 | Settings API | ✅ Listo | /api/settings GET/PUT |
| 12 | Migración datos localhost → Neon | ✅ Listo | scripts/migrate-data.ts |
| 13 | Scripts de testing | ✅ Listo | test-db, test-capture, test-alerts |
| 14 | Git repo + Vercel deploy | ⏳ Pendiente | |
| 15 | jpcode.cl link + cron-job.org | ⏳ Pendiente | |

## Arquitectura

```
cron-job.org (gratis, cada 1 min)
    │
    ├─ GET /api/capture  → ValueClouds API → Neon readings
    └─ GET /api/alerts   → Evaluar condiciones → Telegram
    │
Vercel Hobby (Next.js 16)
    ├── /login            → JWT login
    ├── /dashboard        → Stat cards + Canvas SVG + Charts
    ├── /api/auth/login   → POST, setea cookie JWT
    ├── /api/auth/me      → GET, verifica sesión
    ├── /api/capture      → Edge Function (30s timeout)
    ├── /api/alerts       → Edge Function
    ├── /api/readings     → Time series
    └── /api/latest       → Último valor
            │
    Neon PostgreSQL
    ├── users (auth)
    ├── readings (datos inversor)
    ├── alert_state (estado alertas)
    └── settings (umbrales)
```

## Env vars

| Variable | Valor |
|----------|-------|
| DATABASE_URL | Neon solar DB (pendiente crear) |
| JWT_SECRET | `openssl rand -base64 32` |
| VALUECLOUDS_ACCOUNT | `964078725` |
| VALUECLOUDS_PASSWORD | `Franco155` |
| DEVICE_PN | `I30000251240085132` |
| DEVICE_SN | `DEV19AC2A6529D1E43` |
| DEVICE_DEVCODE | `6422` |
| DEVICE_DEVADDR | `4` |
| TELEGRAM_BOT_TOKEN | `8533427315:AAHKhKBT...` |
| TELEGRAM_CHAT_ID | `-5359583872` |

## DB Schema (Neon)

```sql
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  name TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE readings (
  ts TIMESTAMPTZ NOT NULL,
  source TEXT NOT NULL,
  field_id TEXT NOT NULL,
  title TEXT,
  unit TEXT,
  val DOUBLE PRECISION,
  val_text TEXT,
  PRIMARY KEY (ts, source, field_id)
);
CREATE INDEX idx_readings_field_ts ON readings (field_id, ts DESC);
CREATE INDEX idx_readings_ts ON readings (ts DESC);

CREATE TABLE alert_state (
  channel TEXT PRIMARY KEY,
  severity TEXT NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

## Estructura de archivos

```
~/Desarrollos/web-solar/
├── package.json
├── next.config.ts
├── tsconfig.json
├── postcss.config.mjs
├── .env.example
├── .gitignore
├── PLAN.md
├── src/
│   ├── app/
│   │   ├── layout.tsx
│   │   ├── page.tsx
│   │   ├── globals.css
│   │   ├── login/page.tsx
│   │   ├── dashboard/page.tsx
│   │   └── api/
│   │       ├── auth/login/route.ts
│   │       ├── auth/logout/route.ts
│   │       ├── auth/me/route.ts
│   │       ├── capture/route.ts
│   │       ├── alerts/route.ts
│   │       ├── readings/route.ts
│   │       ├── latest/route.ts
│   │       └── settings/route.ts
│   ├── components/
│   │   ├── AuthProvider.tsx
│   │   ├── Navbar.tsx
│   │   ├── StatCard.tsx
│   │   ├── CanvasFlow.tsx
│   │   ├── TimeSeriesChart.tsx
│   │   └── ReadingsTable.tsx
│   ├── lib/
│   │   ├── db.ts
│   │   ├── auth.ts
│   │   ├── valueclouds.ts
│   │   ├── alerts.ts
│   │   └── types.ts
│   └── middleware.ts
├── scripts/
│   ├── seed-user.ts
│   ├── migrate-data.ts
│   ├── test-capture.ts
│   ├── test-db.ts
│   └── test-alerts.ts
└── .vercel/
    └── project.json
```

## Notas de implementación

- **Auth**: JWT ligero con `jose` (Edge compatible), NO NextAuth
- **DB**: `@neondatabase/serverless` directo (sin Prisma)
- **Capture**: Edge Function, 30s timeout, 3 llamadas a ValueClouds API
- **Cron**: cron-job.org gratis, 1 min interval
- **Canvas SVG**: Diagrama de flujo con puntos de color dinámico
- **Charts**: Recharts con auto-refresh 30s
- **Migración**: pg_dump localhost → INSERT a Neon
