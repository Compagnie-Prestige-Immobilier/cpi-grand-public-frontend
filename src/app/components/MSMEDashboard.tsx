import { useState } from 'react';
import StatCard from './StatCard';
import EscrowStatus from './EscrowStatus';
import { DollarSign, Users, Clock, TrendingUp, Download, ArrowUpRight } from 'lucide-react';

const mockTransactions = [
  {
    id: '1',
    investor: 'Sarah Johnson',
    amount: 50000,
    status: 'released' as const,
    uetr: '97ed4827-7b6f-4491-a06f-b548d12a123f',
    date: '2025-11-15',
    releaseDate: '2025-11-16'
  },
  {
    id: '2',
    investor: 'Michael Chen',
    amount: 75000,
    status: 'released' as const,
    uetr: 'a1b2c3d4-e5f6-g7h8-i9j0-k1l2m3n4o5p6',
    date: '2025-10-30',
    releaseDate: '2025-10-31'
  },
  {
    id: '3',
    investor: 'Emma Rodriguez',
    amount: 35000,
    status: 'pending' as const,
    uetr: '1234abcd-5678-90ef-ghij-klmnopqrstuv',
    date: '2025-11-22',
  },
  {
    id: '4',
    investor: 'James Wilson',
    amount: 25000,
    status: 'escrow' as const,
    uetr: '98765xyz-4321-abcd-efgh-ijklmnopqrst',
    date: '2025-11-28',
  },
];

const mockInvestors = [
  { name: 'Sarah Johnson', country: 'USA', totalInvested: 125000, investments: 3 },
  { name: 'Michael Chen', country: 'Singapore', totalInvested: 200000, investments: 5 },
  { name: 'Emma Rodriguez', country: 'Spain', totalInvested: 85000, investments: 2 },
  { name: 'James Wilson', country: 'UK', totalInvested: 150000, investments: 4 },
];

export default function MSMEDashboard() {
  const [selectedTransaction, setSelectedTransaction] = useState<string | null>(null);

  const stats = {
    incomingFunds: 35000,
    pendingReleases: 25000,
    totalReceived: 125000,
    activeInvestors: 12,
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'released':
        return 'text-emerald-700 bg-emerald-50 border-emerald-200';
      case 'pending':
        return 'text-amber-700 bg-amber-50 border-amber-200';
      case 'escrow':
        return 'text-blue-700 bg-blue-50 border-blue-200';
      default:
        return 'text-slate-700 bg-slate-50 border-slate-200';
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'released':
        return 'Released';
      case 'pending':
        return 'In Progress';
      case 'escrow':
        return 'In Escrow';
      default:
        return status;
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Welcome Section */}
      <div className="mb-8">
        <h2 className="text-slate-900 mb-2">Artisan Textiles Co.</h2>
        <p className="text-slate-600">Monitor incoming funds and manage investor relationships</p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <StatCard
          title="Incoming Funds"
          value={`$${stats.incomingFunds.toLocaleString()}`}
          icon={<DollarSign className="w-5 h-5" />}
          iconColor="text-blue-600"
          bgColor="bg-blue-50"
        />
        <StatCard
          title="Pending Releases"
          value={`$${stats.pendingReleases.toLocaleString()}`}
          icon={<Clock className="w-5 h-5" />}
          iconColor="text-amber-600"
          bgColor="bg-amber-50"
        />
        <StatCard
          title="Total Received"
          value={`$${stats.totalReceived.toLocaleString()}`}
          icon={<TrendingUp className="w-5 h-5" />}
          trend="+15.2%"
          trendUp={true}
          iconColor="text-emerald-600"
          bgColor="bg-emerald-50"
        />
        <StatCard
          title="Active Investors"
          value={stats.activeInvestors.toString()}
          icon={<Users className="w-5 h-5" />}
          iconColor="text-purple-600"
          bgColor="bg-purple-50"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Transactions Section */}
        <div className="lg:col-span-2 space-y-6">
          {/* Recent Transactions */}
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
              <div>
                <h3 className="text-slate-900">Recent Transactions</h3>
                <p className="text-sm text-slate-500 mt-1">Track payment settlements and releases</p>
              </div>
              <button className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2">
                <Download className="w-4 h-4" />
                <span className="hidden sm:inline">Export</span>
              </button>
            </div>
            <div className="divide-y divide-slate-200">
              {mockTransactions.map((transaction) => (
                <div
                  key={transaction.id}
                  className="px-6 py-4 hover:bg-slate-50 transition-colors cursor-pointer"
                  onClick={() => setSelectedTransaction(transaction.id)}
                >
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-blue-600 rounded-full flex items-center justify-center">
                        <span className="text-white">{transaction.investor.charAt(0)}</span>
                      </div>
                      <div>
                        <p className="text-slate-900">{transaction.investor}</p>
                        <p className="text-xs text-slate-500">{transaction.date}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-slate-900">${transaction.amount.toLocaleString()}</p>
                      <span className={`text-xs px-2 py-1 rounded-full border ${getStatusColor(transaction.status)}`}>
                        {getStatusText(transaction.status)}
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 text-xs text-slate-500">
                    <span className="font-mono bg-slate-100 px-2 py-1 rounded">
                      UETR: {transaction.uetr.substring(0, 16)}...
                    </span>
                  </div>
                  {transaction.releaseDate && (
                    <p className="text-xs text-emerald-600 mt-2">
                      Released on {transaction.releaseDate}
                    </p>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Escrow Status Display */}
          {selectedTransaction && (
            <EscrowStatus
              transaction={mockTransactions.find(t => t.id === selectedTransaction)!}
              onClose={() => setSelectedTransaction(null)}
            />
          )}
        </div>

        {/* Active Investors Panel */}
        <div className="space-y-6">
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-200">
              <h3 className="text-slate-900">Active Investors</h3>
              <p className="text-sm text-slate-500 mt-1">Your funding partners</p>
            </div>
            <div className="p-4 space-y-3 max-h-96 overflow-y-auto">
              {mockInvestors.map((investor, index) => (
                <div
                  key={index}
                  className="p-4 bg-gradient-to-br from-slate-50 to-white rounded-lg border border-slate-200 hover:shadow-md transition-all duration-200 cursor-pointer group"
                >
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-gradient-to-br from-purple-500 to-purple-600 rounded-full flex items-center justify-center">
                        <span className="text-white">{investor.name.charAt(0)}</span>
                      </div>
                      <div>
                        <p className="text-slate-900">{investor.name}</p>
                        <p className="text-xs text-slate-500">{investor.country}</p>
                      </div>
                    </div>
                    <ArrowUpRight className="w-4 h-4 text-slate-400 group-hover:text-blue-600 transition-colors" />
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <div>
                      <p className="text-xs text-slate-500">Total Invested</p>
                      <p className="text-slate-900">${(investor.totalInvested / 1000).toFixed(0)}K</p>
                    </div>
                    <div>
                      <p className="text-xs text-slate-500">Investments</p>
                      <p className="text-slate-900">{investor.investments}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Quick Actions */}
          <div className="bg-gradient-to-br from-blue-600 to-blue-700 rounded-xl shadow-sm p-6 text-white">
            <h3 className="mb-2">Financial Reports</h3>
            <p className="text-sm text-blue-100 mb-4">Generate automated reports for your records</p>
            <button className="w-full px-4 py-2 bg-white text-blue-700 rounded-lg hover:bg-blue-50 transition-colors flex items-center justify-center gap-2">
              <Download className="w-4 h-4" />
              Generate Report
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
