# PLAN: web-solar — Monitor Solar Web

## Estado general

| # | Paso | Estado | Notas |
|---|------|--------|-------|
| 1 | Setup proyecto Next.js + deps | ✅ Listo | Next.js 16.3.3 + Neon + Recharts + jose + bcryptjs + tsx |
| 2 | DB schema + seed user en Neon | ✅ Listo | scripts/seed-user.ts crea tablas + usuario |
| 3 | Auth (lib + middleware + login) | ✅ Listo | JWT jose + middleware + API routes |
| 4 | ValueClouds API client TS | ✅ Listo | valueclouds.ts + flatten functions |
| 5 | API capture (Edge Function) | ✅ Listo | /api/capture, runtime=edge |
| 6 | API readings/latest | ✅ Listo | /api/readings, /api/latest |
| 7 | Dashboard UI + StatCards | ✅ Listo | layout + page + StatCard |
| 8 | Canvas SVG flujo energía | ✅ Listo | CanvasFlow.tsx |
| 9 | Charts (Recharts) | ✅ Listo | TimeSeriesChart.tsx |
| 10 | Alertas + Telegram | ✅ Listo | alerts.ts + /api/alerts |
| 11 | Settings API | ✅ Listo | /api/settings GET/PUT |
| 12 | Migración datos localhost → Neon | ⚠️ Parcial | 353K/3.5M rows migrados (4 days). Resta pendiente. |
| 13 | Scripts de testing | ✅ Listo | test-db, test-capture, test-alerts |
| 14 | Git repo + Vercel deploy | ✅ Listo | https://solar.jpcode.cl — deploy automático via GitHub |
| 15 | jpcode.cl link | ✅ Listo | SOLAR_URL=https://solar.jpcode.cl en jpcode-home |
| 16 | cron-job.org (capture + alerts) | ✅ Listo | Jobs #8344560 + #8344563, cada 1 min, America/Santiago |

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

## Pasos manuales restantes

### 1. Crear DB en Neon
1. Ir a console.neon.tech
2. Seleccionar proyecto existente (el de rowfut/nutriflow)
3. Create database → nombre: `solar`
4. Copiar connection string

### 2. Seed usuario + tablas
```bash
cd ~/Desarrollos/web-solar
DATABASE_URL="<neon-connection-string>" npx tsx scripts/seed-user.ts admin@jpcode.cl "solar123"
```

### 3. Migrar datos históricos
```bash
DATABASE_URL_LOCAL="postgresql://postgres:ugas4210@localhost:5432/solar" \
DATABASE_URL_NEON="<neon-connection-string>" \
npx tsx scripts/migrate-data.ts
```

### 4. Deploy a Vercel
```bash
cd ~/Desarrollos/web-solar
gh repo create jpugas19/web-solar --public --source=. --remote=origin --push
vercel link
vercel env add DATABASE_URL production
vercel env add JWT_SECRET production
vercel env add VALUECLOUDS_ACCOUNT production
vercel env add VALUECLOUDS_PASSWORD production
vercel env add DEVICE_PN production
vercel env add DEVICE_SN production
vercel env add DEVICE_DEVCODE production
vercel env add DEVICE_DEVADDR production
vercel env add TELEGRAM_BOT_TOKEN production
vercel env add TELEGRAM_CHAT_ID production
vercel --prod
vercel domains add solar.jpcode.cl
```

### 5. Actualizar jpcode.cl
En Vercel dashboard de jpcode-home:
- Agregar env var: `SOLAR_URL=https://solar.jpcode.cl`

### 6. Configurar cron-job.org
1. Crear cuenta gratis en cron-job.org
2. Job 1: `GET https://solar.jpcode.cl/api/capture`, cada 1 minuto
3. Job 2: `GET https://solar.jpcode.cl/api/alerts`, cada 1 minuto
