interface CanvasFlowProps {
  pvPower: number | null;
  inverterPower: number | null;
  loadPower: number | null;
  gridPower: number | null;
  batteryVoltage: number | null;
  soc: number | null;
  batMode: number; // 0=idle, 1=charging, 2=discharging
  loadMode: number; // 0=none, 1=solar, 2=battery, 3=grid
  gridSupply: number; // 0=off, 1=on
  pvGen: number; // 0=off, 1=on
}

function formatW(w: number | null): string {
  if (w === null) return "--";
  const abs = Math.abs(w);
  if (abs >= 1000) return `${(abs / 1000).toFixed(2)} kW`;
  return `${abs.toFixed(0)} W`;
}

function Dot({ x, y, active, color }: { x: number; y: number; active: boolean; color: string }) {
  return (
    <circle
      cx={x}
      cy={y}
      r={8}
      fill={active ? color : "#374151"}
      opacity={active ? 1 : 0.3}
    />
  );
}

export default function CanvasFlow({
  pvPower,
  inverterPower,
  loadPower,
  gridPower,
  batteryVoltage,
  soc,
  batMode,
  loadMode,
  gridSupply,
  pvGen,
}: CanvasFlowProps) {
  return (
    <div className="flex justify-center overflow-x-auto">
      <svg viewBox="0 0 700 300" className="w-full max-w-3xl" xmlns="http://www.w3.org/2000/svg">
        {/* Connections */}
        {/* PV -> Inverter */}
        <line x1="140" y1="100" x2="260" y2="100" stroke="#4b5563" strokeWidth="3" />
        <Dot x={200} y={100} active={pvGen === 1} color="#f59e0b" />

        {/* Inverter -> Load */}
        <line x1="400" y1="100" x2="520" y2="100" stroke="#4b5563" strokeWidth="3" />
        <Dot x={460} y={100} active={loadMode > 0} color={loadMode === 1 ? "#f59e0b" : loadMode === 2 ? "#3b82f6" : loadMode === 3 ? "#06b6d4" : "#374151"} />

        {/* Inverter -> Battery (down) */}
        <line x1="330" y1="140" x2="330" y2="210" stroke="#4b5563" strokeWidth="3" />
        <Dot x={330} y={175} active={batMode > 0} color={batMode === 1 ? "#22c55e" : batMode === 2 ? "#3b82f6" : "#374151"} />

        {/* Inverter -> Grid (down-right) */}
        <line x1="380" y1="140" x2="480" y2="210" stroke="#4b5563" strokeWidth="3" />
        <Dot x={430} y={175} active={gridSupply === 1} color="#06b6d4" />

        {/* Boxes */}
        {/* PV Panels */}
        <rect x="40" y="60" width="100" height="80" rx="8" fill="#1c1917" stroke="#f59e0b" strokeWidth="2" />
        <text x="90" y="90" textAnchor="middle" fill="#f59e0b" fontSize="11" fontWeight="bold">
          PANELES
        </text>
        <text x="90" y="108" textAnchor="middle" fill="#d6d3d1" fontSize="12">
          {formatW(pvPower)}
        </text>

        {/* Inverter */}
        <rect x="260" y="60" width="140" height="80" rx="8" fill="#1c1917" stroke="#6b7280" strokeWidth="2" />
        <text x="330" y="85" textAnchor="middle" fill="#9ca3af" fontSize="10" fontWeight="bold">
          INVERSOR
        </text>
        <text x="330" y="103" textAnchor="middle" fill="#d6d3d1" fontSize="11">
          MUST PV18
        </text>
        <text x="330" y="120" textAnchor="middle" fill="#9ca3af" fontSize="10">
          {formatW(inverterPower)}
        </text>

        {/* Load */}
        <rect x="520" y="60" width="100" height="80" rx="8" fill="#1c1917" stroke="#6b7280" strokeWidth="2" />
        <text x="570" y="90" textAnchor="middle" fill="#9ca3af" fontSize="11" fontWeight="bold">
          CARGA
        </text>
        <text x="570" y="108" textAnchor="middle" fill="#d6d3d1" fontSize="12">
          {formatW(loadPower)}
        </text>

        {/* Battery */}
        <rect x="260" y="210" width="140" height="70" rx="8" fill="#1c1917" stroke="#3b82f6" strokeWidth="2" />
        <text x="330" y="235" textAnchor="middle" fill="#3b82f6" fontSize="11" fontWeight="bold">
          BATERIAS
        </text>
        <text x="330" y="255" textAnchor="middle" fill="#d6d3d1" fontSize="11">
          {soc !== null ? `${soc.toFixed(0)}%` : "--"} · {batteryVoltage !== null ? `${batteryVoltage.toFixed(1)}V` : "--"}
        </text>
        <text x="330" y="272" textAnchor="middle" fill="#9ca3af" fontSize="9">
          {batMode === 1 ? "Cargando" : batMode === 2 ? "Descargando" : "Idle"}
        </text>

        {/* Grid */}
        <rect x="430" y="210" width="140" height="70" rx="8" fill="#1c1917" stroke="#06b6d4" strokeWidth="2" />
        <text x="500" y="235" textAnchor="middle" fill="#06b6d4" fontSize="11" fontWeight="bold">
          RED
        </text>
        <text x="500" y="255" textAnchor="middle" fill="#d6d3d1" fontSize="11">
          {gridPower !== null ? formatW(gridPower * 1000) : "--"}
        </text>
        <text x="500" y="272" textAnchor="middle" fill="#9ca3af" fontSize="9">
          {gridSupply === 1 ? "Importando" : "Sin conexion"}
        </text>
      </svg>
    </div>
  );
}
