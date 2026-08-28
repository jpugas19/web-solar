const colorMap: Record<string, string> = {
  amber: "bg-amber-500/10 text-amber-400",
  green: "bg-green-500/10 text-green-400",
  red: "bg-red-500/10 text-red-400",
  blue: "bg-blue-500/10 text-blue-400",
  cyan: "bg-cyan-500/10 text-cyan-400",
  gray: "bg-gray-500/10 text-gray-400",
};

interface StatCardProps {
  title: string;
  value: string;
  color: string;
}

export default function StatCard({ title, value, color }: StatCardProps) {
  const colorClass = colorMap[color] || colorMap.gray;

  return (
    <div className="rounded-xl border border-gray-800 bg-gray-900 p-4">
      <div className="text-xs font-medium text-gray-500 uppercase tracking-wide">
        {title}
      </div>
      <div className={`mt-2 text-2xl font-bold ${colorClass.split(" ")[1]}`}>
        {value}
      </div>
    </div>
  );
}
