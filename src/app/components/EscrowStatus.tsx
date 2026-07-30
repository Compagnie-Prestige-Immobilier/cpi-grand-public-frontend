import { X, Shield, Sparkles, CheckCircle2, Clock } from 'lucide-react';
import { motion } from 'motion/react';

interface Transaction {
  id: string;
  investor: string;
  amount: number;
  status: 'pending' | 'escrow' | 'released';
  uetr: string;
  date: string;
  releaseDate?: string;
}

interface EscrowStatusProps {
  transaction: Transaction;
  onClose: () => void;
}

export default function EscrowStatus({ transaction, onClose }: EscrowStatusProps) {
  const isReleased = transaction.status === 'released';
  const isInEscrow = transaction.status === 'escrow';

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      className="bg-white rounded-xl shadow-lg border-2 border-blue-500 overflow-hidden"
    >
      {/* Header */}
      <div className={`px-6 py-4 text-white ${
        isReleased 
          ? 'bg-gradient-to-r from-emerald-600 to-emerald-700' 
          : 'bg-gradient-to-r from-blue-600 to-blue-700'
      }`}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Shield className="w-6 h-6" />
            <div>
              <h3>Escrow Status</h3>
              <p className={`text-sm ${isReleased ? 'text-emerald-100' : 'text-blue-100'}`}>
                {transaction.investor}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className={`p-2 rounded-lg transition-colors ${
              isReleased ? 'hover:bg-emerald-500' : 'hover:bg-blue-500'
            }`}
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      </div>

      <div className="p-6">
        {/* Amount Display */}
        <div className="bg-gradient-to-br from-slate-50 to-blue-50 rounded-lg p-6 mb-6 text-center border border-slate-200">
          <p className="text-sm text-slate-600 mb-2">Transaction Amount</p>
          <p className="text-slate-900">${transaction.amount.toLocaleString()}</p>
        </div>

        {/* Status Animation */}
        <div className="mb-6">
          {isReleased ? (
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              className="bg-gradient-to-br from-emerald-50 to-green-50 rounded-xl p-6 border-2 border-emerald-200"
            >
              <div className="flex flex-col items-center text-center">
                <motion.div
                  animate={{ rotate: [0, 10, -10, 0] }}
                  transition={{ duration: 0.5, delay: 0.2 }}
                >
                  <Sparkles className="w-12 h-12 text-emerald-600 mb-4" />
                </motion.div>
                <h3 className="text-emerald-900 mb-2">Funds Released!</h3>
                <p className="text-sm text-emerald-700 mb-4">
                  Automatically released upon SWIFT gpi confirmation
                </p>
                {transaction.releaseDate && (
                  <div className="flex items-center gap-2 text-xs text-emerald-600 bg-emerald-100 px-3 py-2 rounded-full">
                    <CheckCircle2 className="w-4 h-4" />
                    <span>Released on {transaction.releaseDate}</span>
                  </div>
                )}
              </div>
            </motion.div>
          ) : isInEscrow ? (
            <motion.div
              className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-xl p-6 border-2 border-blue-200"
            >
              <div className="flex flex-col items-center text-center">
                <motion.div
                  animate={{ scale: [1, 1.1, 1] }}
                  transition={{ duration: 2, repeat: Infinity }}
                >
                  <Shield className="w-12 h-12 text-blue-600 mb-4" />
                </motion.div>
                <h3 className="text-blue-900 mb-2">Secured in Escrow</h3>
                <p className="text-sm text-blue-700 mb-4">
                  Funds are safely held until SWIFT gpi confirms settlement
                </p>
                <div className="w-full bg-blue-100 rounded-full h-2 overflow-hidden">
                  <motion.div
                    className="h-full bg-blue-600"
                    animate={{ width: ['0%', '100%'] }}
                    transition={{ duration: 2, repeat: Infinity }}
                  />
                </div>
              </div>
            </motion.div>
          ) : (
            <motion.div
              className="bg-gradient-to-br from-amber-50 to-orange-50 rounded-xl p-6 border-2 border-amber-200"
            >
              <div className="flex flex-col items-center text-center">
                <Clock className="w-12 h-12 text-amber-600 mb-4" />
                <h3 className="text-amber-900 mb-2">Processing Payment</h3>
                <p className="text-sm text-amber-700">
                  Awaiting SWIFT gpi confirmation to move to escrow
                </p>
              </div>
            </motion.div>
          )}
        </div>

        {/* UETR Reference */}
        <div className="bg-slate-50 rounded-lg p-4 border border-slate-200">
          <p className="text-xs text-slate-500 mb-2">SWIFT gpi UETR</p>
          <p className="font-mono text-xs text-slate-700 break-all">
            {transaction.uetr}
          </p>
        </div>

        {/* Timeline */}
        <div className="mt-6 space-y-3">
          <div className="flex items-start gap-3">
            <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
              isReleased || isInEscrow ? 'bg-emerald-100' : 'bg-slate-100'
            }`}>
              <CheckCircle2 className={`w-4 h-4 ${
                isReleased || isInEscrow ? 'text-emerald-600' : 'text-slate-400'
              }`} />
            </div>
            <div className="flex-1">
              <p className="text-sm text-slate-900">Payment Initiated</p>
              <p className="text-xs text-slate-500">{transaction.date}</p>
            </div>
          </div>

          <div className="flex items-start gap-3">
            <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
              isReleased ? 'bg-emerald-100' : isInEscrow ? 'bg-blue-100' : 'bg-slate-100'
            }`}>
              {isReleased ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
              ) : isInEscrow ? (
                <Shield className="w-4 h-4 text-blue-600" />
              ) : (
                <Clock className="w-4 h-4 text-slate-400" />
              )}
            </div>
            <div className="flex-1">
              <p className="text-sm text-slate-900">Secured in Escrow</p>
              {isInEscrow && (
                <p className="text-xs text-blue-600">Awaiting confirmation...</p>
              )}
            </div>
          </div>

          <div className="flex items-start gap-3">
            <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
              isReleased ? 'bg-emerald-100' : 'bg-slate-100'
            }`}>
              {isReleased ? (
                <Sparkles className="w-4 h-4 text-emerald-600" />
              ) : (
                <Clock className="w-4 h-4 text-slate-400" />
              )}
            </div>
            <div className="flex-1">
              <p className="text-sm text-slate-900">Auto-Release to MSME</p>
              {isReleased && transaction.releaseDate && (
                <p className="text-xs text-emerald-600">{transaction.releaseDate}</p>
              )}
            </div>
          </div>
        </div>

        {/* Automation Notice */}
        <div className="mt-6 p-4 bg-gradient-to-r from-blue-50 to-indigo-50 rounded-lg border border-blue-200">
          <div className="flex items-start gap-3">
            <Sparkles className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-sm text-blue-900 mb-1">Fully Automated Process</p>
              <p className="text-xs text-blue-700">
                No manual intervention required. The system automatically releases funds when SWIFT gpi confirms successful settlement, ensuring transparency and speed.
              </p>
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  );
}
