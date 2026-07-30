import { Clock, CheckCircle2, AlertCircle, Sparkles } from 'lucide-react';

interface Investment {
  id: string;
  msmeName: string;
  country: string;
  amount: number;
  expectedReturn: number;
  status: 'pending' | 'in-progress' | 'confirmed' | 'released';
  uetr: string;
  progress: number;
  date: string;
  industry: string;
}

interface InvestmentCardProps {
  investment: Investment;
  onClick: () => void;
  isSelected: boolean;
}

export default function InvestmentCard({ investment, onClick, isSelected }: InvestmentCardProps) {
  const getStatusConfig = (status: string) => {
    switch (status) {
      case 'pending':
        return {
          icon: <Clock className="w-4 h-4" />,
          color: 'text-slate-600',
          bgColor: 'bg-slate-100',
          label: 'Pending',
        };
      case 'in-progress':
        return {
          icon: <AlertCircle className="w-4 h-4" />,
          color: 'text-blue-600',
          bgColor: 'bg-blue-100',
          label: 'In Progress',
        };
      case 'confirmed':
        return {
          icon: <CheckCircle2 className="w-4 h-4" />,
          color: 'text-emerald-600',
          bgColor: 'bg-emerald-100',
          label: 'Confirmed',
        };
      case 'released':
        return {
          icon: <Sparkles className="w-4 h-4" />,
          color: 'text-emerald-600',
          bgColor: 'bg-emerald-100',
          label: 'Released',
        };
      default:
        return {
          icon: <Clock className="w-4 h-4" />,
          color: 'text-slate-600',
          bgColor: 'bg-slate-100',
          label: 'Unknown',
        };
    }
  };

  const statusConfig = getStatusConfig(investment.status);
  const returnPercentage = ((investment.expectedReturn - investment.amount) / investment.amount * 100).toFixed(1);

  return (
    <div
      onClick={onClick}
      className={`bg-white rounded-xl shadow-sm border-2 transition-all duration-200 cursor-pointer hover:shadow-md ${
        isSelected ? 'border-blue-500 shadow-lg' : 'border-slate-200 hover:border-blue-300'
      }`}
    >
      <div className="p-6">
        {/* Header */}
        <div className="flex items-start justify-between mb-4">
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-2">
              <h3 className="text-slate-900">{investment.msmeName}</h3>
            </div>
            <div className="flex items-center gap-2 text-sm text-slate-500">
              <span>{investment.industry}</span>
              <span>•</span>
              <span>{investment.country}</span>
            </div>
          </div>
          <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full ${statusConfig.bgColor} ${statusConfig.color}`}>
            {statusConfig.icon}
            <span className="text-sm">{statusConfig.label}</span>
          </div>
        </div>

        {/* Investment Details */}
        <div className="grid grid-cols-2 gap-4 mb-4">
          <div>
            <p className="text-xs text-slate-500 mb-1">Investment Amount</p>
            <p className="text-slate-900">${investment.amount.toLocaleString()}</p>
          </div>
          <div>
            <p className="text-xs text-slate-500 mb-1">Expected Return</p>
            <p className="text-emerald-700">
              ${investment.expectedReturn.toLocaleString()}
              <span className="text-xs ml-1">({returnPercentage}%)</span>
            </p>
          </div>
        </div>

        {/* Progress Bar */}
        <div className="mb-4">
          <div className="flex items-center justify-between mb-2">
            <p className="text-xs text-slate-500">Settlement Progress</p>
            <p className="text-xs text-slate-700">{investment.progress}%</p>
          </div>
          <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-500 ${
                investment.status === 'released' || investment.status === 'confirmed'
                  ? 'bg-gradient-to-r from-emerald-500 to-emerald-600'
                  : investment.status === 'in-progress'
                  ? 'bg-gradient-to-r from-blue-500 to-blue-600'
                  : 'bg-gradient-to-r from-slate-400 to-slate-500'
              }`}
              style={{ width: `${investment.progress}%` }}
            />
          </div>
        </div>

        {/* UETR Reference */}
        <div className="pt-4 border-t border-slate-200">
          <p className="text-xs text-slate-500 mb-1">UETR Reference</p>
          <p className="font-mono text-xs text-slate-700 bg-slate-50 px-3 py-2 rounded">
            {investment.uetr}
          </p>
        </div>

        {/* Click to track indicator */}
        <div className="mt-4 text-center">
          <p className="text-xs text-blue-600">
            {isSelected ? '▲ Hide tracking details' : '▼ Click to track payment'}
          </p>
        </div>
      </div>
    </div>
  );
}
