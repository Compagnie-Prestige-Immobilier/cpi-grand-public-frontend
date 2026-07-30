import { X, CheckCircle2, Circle, Clock, Sparkles } from 'lucide-react';
import { motion } from 'motion/react';
import TransactionTimeline from './TransactionTimeline';

interface Investment {
  id: string;
  msmeName: string;
  amount: number;
  status: 'pending' | 'in-progress' | 'confirmed' | 'released';
  uetr: string;
  progress: number;
  date: string;
}

interface PaymentTrackerProps {
  investment: Investment;
  onClose: () => void;
}

export default function PaymentTracker({ investment, onClose }: PaymentTrackerProps) {
  const stages = [
    {
      id: 1,
      label: 'Payment Sent',
      status: investment.progress >= 25 ? 'completed' : investment.progress > 0 ? 'in-progress' : 'pending',
      timestamp: investment.progress >= 25 ? `${investment.date} 09:15 UTC` : null,
      details: 'Payment instruction received from investor',
    },
    {
      id: 2,
      label: 'Bank Processing',
      status: investment.progress >= 50 ? 'completed' : investment.progress >= 25 ? 'in-progress' : 'pending',
      timestamp: investment.progress >= 50 ? `${investment.date} 10:42 UTC` : null,
      details: 'SWIFT gpi network processing transaction',
    },
    {
      id: 3,
      label: 'Confirmation',
      status: investment.progress >= 75 ? 'completed' : investment.progress >= 50 ? 'in-progress' : 'pending',
      timestamp: investment.progress >= 75 ? `${investment.date} 12:08 UTC` : null,
      details: 'Settlement confirmed by receiving bank',
    },
    {
      id: 4,
      label: 'Escrow Release',
      status: investment.progress === 100 ? 'completed' : investment.progress >= 75 ? 'in-progress' : 'pending',
      timestamp: investment.progress === 100 ? `${investment.date} 12:15 UTC` : null,
      details: 'Funds automatically released to MSME',
    },
  ];

  const getStageIcon = (status: string) => {
    switch (status) {
      case 'completed':
        return <CheckCircle2 className="w-5 h-5 text-emerald-600" />;
      case 'in-progress':
        return <Clock className="w-5 h-5 text-blue-600 animate-pulse" />;
      default:
        return <Circle className="w-5 h-5 text-slate-300" />;
    }
  };

  const getStageColor = (status: string) => {
    switch (status) {
      case 'completed':
        return 'bg-emerald-50 border-emerald-200';
      case 'in-progress':
        return 'bg-blue-50 border-blue-200';
      default:
        return 'bg-slate-50 border-slate-200';
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      className="bg-white rounded-xl shadow-lg border-2 border-blue-500 overflow-hidden"
    >
      {/* Header */}
      <div className="bg-gradient-to-r from-blue-600 to-blue-700 px-6 py-4 text-white">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="mb-1">Real-Time Payment Tracking</h3>
            <p className="text-sm text-blue-100">
              Powered by SWIFT gpi • {investment.msmeName}
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-blue-500 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      </div>

      <div className="p-6">
        {/* UETR Display */}
        <div className="bg-gradient-to-br from-slate-50 to-blue-50 rounded-lg p-4 mb-6 border border-slate-200">
          <div className="flex items-center gap-2 mb-2">
            <Sparkles className="w-4 h-4 text-blue-600" />
            <p className="text-sm text-slate-700">Unique End-to-End Transaction Reference</p>
          </div>
          <p className="font-mono text-slate-900 break-all">
            {investment.uetr}
          </p>
        </div>

        {/* Visual Timeline */}
        <TransactionTimeline progress={investment.progress} />

        {/* Detailed Stages */}
        <div className="space-y-3 mt-6">
          {stages.map((stage, index) => (
            <motion.div
              key={stage.id}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: index * 0.1 }}
              className={`p-4 rounded-lg border ${getStageColor(stage.status)}`}
            >
              <div className="flex items-start gap-3">
                <div className="mt-0.5">
                  {getStageIcon(stage.status)}
                </div>
                <div className="flex-1">
                  <div className="flex items-center justify-between mb-1">
                    <p className="text-slate-900">{stage.label}</p>
                    {stage.timestamp && (
                      <p className="text-xs text-slate-500">{stage.timestamp}</p>
                    )}
                  </div>
                  <p className="text-sm text-slate-600">{stage.details}</p>
                  {stage.status === 'in-progress' && (
                    <div className="mt-2 h-1 bg-slate-200 rounded-full overflow-hidden">
                      <motion.div
                        className="h-full bg-blue-600"
                        animate={{ width: ['0%', '100%'] }}
                        transition={{ duration: 2, repeat: Infinity }}
                      />
                    </div>
                  )}
                </div>
              </div>
            </motion.div>
          ))}
        </div>

        {/* Automated Notice */}
        <div className="mt-6 p-4 bg-gradient-to-r from-emerald-50 to-green-50 rounded-lg border border-emerald-200">
          <div className="flex items-start gap-3">
            <Sparkles className="w-5 h-5 text-emerald-600 mt-0.5" />
            <div>
              <p className="text-emerald-900 mb-1">Fully Automated Settlement</p>
              <p className="text-sm text-emerald-700">
                No manual verification required. Funds will be automatically released to the MSME upon SWIFT gpi confirmation.
              </p>
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  );
}
