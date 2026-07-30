import { motion } from 'motion/react';
import { Send, Building2, CheckCircle2, Unlock } from 'lucide-react';

interface TransactionTimelineProps {
  progress: number;
}

export default function TransactionTimeline({ progress }: TransactionTimelineProps) {
  const steps = [
    { id: 1, label: 'Sent', icon: Send, threshold: 25 },
    { id: 2, label: 'Processing', icon: Building2, threshold: 50 },
    { id: 3, label: 'Confirmed', icon: CheckCircle2, threshold: 75 },
    { id: 4, label: 'Released', icon: Unlock, threshold: 100 },
  ];

  const getStepStatus = (threshold: number) => {
    if (progress >= threshold) return 'completed';
    if (progress >= threshold - 20) return 'in-progress';
    return 'pending';
  };

  const getStepColor = (status: string) => {
    switch (status) {
      case 'completed':
        return 'bg-emerald-600 text-white border-emerald-600';
      case 'in-progress':
        return 'bg-blue-600 text-white border-blue-600';
      default:
        return 'bg-slate-200 text-slate-400 border-slate-200';
    }
  };

  const getLineColor = (index: number) => {
    const nextThreshold = steps[index + 1]?.threshold || 100;
    if (progress >= nextThreshold) return 'bg-emerald-600';
    if (progress >= steps[index].threshold) return 'bg-blue-600';
    return 'bg-slate-200';
  };

  return (
    <div className="py-4">
      <div className="flex items-center justify-between relative">
        {/* Connection Lines */}
        <div className="absolute top-5 left-0 right-0 flex items-center">
          {steps.slice(0, -1).map((step, index) => (
            <div key={`line-${step.id}`} className="flex-1 px-8 first:pl-0 last:pr-0">
              <div className="h-1 bg-slate-200 rounded-full overflow-hidden">
                <motion.div
                  className={`h-full ${getLineColor(index)}`}
                  initial={{ width: 0 }}
                  animate={{ 
                    width: progress >= steps[index + 1].threshold 
                      ? '100%' 
                      : progress >= step.threshold 
                      ? `${((progress - step.threshold) / (steps[index + 1].threshold - step.threshold)) * 100}%`
                      : '0%'
                  }}
                  transition={{ duration: 0.5 }}
                />
              </div>
            </div>
          ))}
        </div>

        {/* Steps */}
        {steps.map((step, index) => {
          const status = getStepStatus(step.threshold);
          const Icon = step.icon;

          return (
            <div key={step.id} className="flex flex-col items-center relative z-10">
              <motion.div
                className={`w-10 h-10 rounded-full border-2 flex items-center justify-center transition-all duration-300 ${getStepColor(status)}`}
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ delay: index * 0.1 }}
              >
                <Icon className="w-5 h-5" />
                {status === 'in-progress' && (
                  <motion.div
                    className="absolute inset-0 rounded-full border-2 border-blue-400"
                    animate={{ scale: [1, 1.3, 1], opacity: [1, 0, 1] }}
                    transition={{ duration: 2, repeat: Infinity }}
                  />
                )}
              </motion.div>
              <p className={`text-xs mt-2 text-center ${
                status === 'completed' ? 'text-emerald-700' :
                status === 'in-progress' ? 'text-blue-700' :
                'text-slate-500'
              }`}>
                {step.label}
              </p>
            </div>
          );
        })}
      </div>

      {/* Progress Percentage */}
      <div className="mt-6 text-center">
        <motion.p
          className="text-slate-900"
          key={progress}
          initial={{ scale: 1.2 }}
          animate={{ scale: 1 }}
        >
          {progress}% Complete
        </motion.p>
        <div className="mt-2 h-2 bg-slate-100 rounded-full overflow-hidden max-w-md mx-auto">
          <motion.div
            className={`h-full ${progress === 100 ? 'bg-emerald-600' : 'bg-blue-600'}`}
            initial={{ width: 0 }}
            animate={{ width: `${progress}%` }}
            transition={{ duration: 1 }}
          />
        </div>
      </div>
    </div>
  );
}
