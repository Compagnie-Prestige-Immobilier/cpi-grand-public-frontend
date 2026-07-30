import { ArrowUpRight, ArrowDownRight } from 'lucide-react';
import { ReactNode } from 'react';

interface StatCardProps {
  title: string;
  value: string;
  icon: ReactNode;
  trend?: string;
  trendUp?: boolean;
  iconColor?: string;
  bgColor?: string;
}

export default function StatCard({
  title,
  value,
  icon,
  trend,
  trendUp,
  iconColor = 'text-blue-600',
  bgColor = 'bg-blue-50',
}: StatCardProps) {
  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 hover:shadow-md transition-all duration-200">
      <div className="flex items-start justify-between mb-4">
        <div className={`${bgColor} ${iconColor} p-3 rounded-lg`}>
          {icon}
        </div>
        {trend && (
          <div className={`flex items-center gap-1 text-sm ${trendUp ? 'text-emerald-600' : 'text-red-600'}`}>
            {trendUp ? (
              <ArrowUpRight className="w-4 h-4" />
            ) : (
              <ArrowDownRight className="w-4 h-4" />
            )}
            <span>{trend}</span>
          </div>
        )}
      </div>
      <div>
        <p className="text-slate-500 text-sm mb-1">{title}</p>
        <p className="text-slate-900">{value}</p>
      </div>
    </div>
  );
}
