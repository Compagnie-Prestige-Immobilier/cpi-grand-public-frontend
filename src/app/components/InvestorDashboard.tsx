import { useState } from 'react';
import StatCard from './StatCard';
import InvestmentCard from './InvestmentCard';
import NotificationsPanel from './NotificationsPanel';
import PaymentTracker from './PaymentTracker';
import { TrendingUp, Clock, CheckCircle2, DollarSign } from 'lucide-react';

const mockInvestments = [
  {
    id: '1',
    msmeName: 'Artisan Textiles Co.',
    country: 'India',
    amount: 50000,
    expectedReturn: 58500,
    status: 'confirmed' as const,
    uetr: '97ed4827-7b6f-4491-a06f-b548d12a123f',
    progress: 100,
    date: '2025-11-15',
    industry: 'Textiles'
  },
  {
    id: '2',
    msmeName: 'Global Spice Exports',
    country: 'Vietnam',
    amount: 35000,
    expectedReturn: 40250,
    status: 'in-progress' as const,
    uetr: '1234abcd-5678-90ef-ghij-klmnopqrstuv',
    progress: 65,
    date: '2025-11-22',
    industry: 'Food & Beverage'
  },
  {
    id: '3',
    msmeName: 'Eco Crafts Ltd.',
    country: 'Kenya',
    amount: 25000,
    expectedReturn: 27500,
    status: 'pending' as const,
    uetr: '98765xyz-4321-abcd-efgh-ijklmnopqrst',
    progress: 20,
    date: '2025-11-28',
    industry: 'Handicrafts'
  },
  {
    id: '4',
    msmeName: 'TechParts Manufacturing',
    country: 'Thailand',
    amount: 75000,
    expectedReturn: 86250,
    status: 'released' as const,
    uetr: 'a1b2c3d4-e5f6-g7h8-i9j0-k1l2m3n4o5p6',
    progress: 100,
    date: '2025-10-30',
    industry: 'Electronics'
  },
];

export default function InvestorDashboard() {
  const [selectedInvestment, setSelectedInvestment] = useState<string | null>(null);
  const [filter, setFilter] = useState<'all' | 'active' | 'pending' | 'completed'>('all');

  const stats = {
    totalInvestments: 185000,
    activeInvestments: 4,
    pendingPayments: 1,
    totalReturns: 34750,
  };

  const filteredInvestments = mockInvestments.filter(inv => {
    if (filter === 'all') return true;
    if (filter === 'active') return inv.status === 'in-progress' || inv.status === 'confirmed';
    if (filter === 'pending') return inv.status === 'pending';
    if (filter === 'completed') return inv.status === 'released';
    return true;
  });

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="flex flex-col lg:flex-row gap-8">
        {/* Main Content */}
        <div className="flex-1">
          {/* Welcome Section */}
          <div className="mb-8">
            <h2 className="text-slate-900 mb-2">Welcome back, Sarah</h2>
            <p className="text-slate-600">Track your investments and monitor real-time payment settlements</p>
          </div>

          {/* Stats Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
            <StatCard
              title="Total Investments"
              value={`$${stats.totalInvestments.toLocaleString()}`}
              icon={<DollarSign className="w-5 h-5" />}
              trend="+12.5%"
              trendUp={true}
            />
            <StatCard
              title="Active Investments"
              value={stats.activeInvestments.toString()}
              icon={<TrendingUp className="w-5 h-5" />}
              iconColor="text-blue-600"
              bgColor="bg-blue-50"
            />
            <StatCard
              title="Pending Payments"
              value={stats.pendingPayments.toString()}
              icon={<Clock className="w-5 h-5" />}
              iconColor="text-amber-600"
              bgColor="bg-amber-50"
            />
            <StatCard
              title="Total Returns"
              value={`$${stats.totalReturns.toLocaleString()}`}
              icon={<CheckCircle2 className="w-5 h-5" />}
              trend="+8.3%"
              trendUp={true}
              iconColor="text-emerald-600"
              bgColor="bg-emerald-50"
            />
          </div>

          {/* Filter Tabs */}
          <div className="flex gap-2 mb-6 overflow-x-auto pb-2">
            {(['all', 'active', 'pending', 'completed'] as const).map((filterOption) => (
              <button
                key={filterOption}
                onClick={() => setFilter(filterOption)}
                className={`px-4 py-2 rounded-lg whitespace-nowrap transition-all duration-200 ${
                  filter === filterOption
                    ? 'bg-blue-600 text-white shadow-sm'
                    : 'bg-white text-slate-600 hover:bg-slate-50 border border-slate-200'
                }`}
              >
                {filterOption.charAt(0).toUpperCase() + filterOption.slice(1)} Investments
              </button>
            ))}
          </div>

          {/* Investments Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-8">
            {filteredInvestments.map((investment) => (
              <InvestmentCard
                key={investment.id}
                investment={investment}
                onClick={() => setSelectedInvestment(investment.id)}
                isSelected={selectedInvestment === investment.id}
              />
            ))}
          </div>

          {/* Payment Tracker - Shows when investment is selected */}
          {selectedInvestment && (
            <PaymentTracker
              investment={mockInvestments.find(inv => inv.id === selectedInvestment)!}
              onClose={() => setSelectedInvestment(null)}
            />
          )}
        </div>

        {/* Notifications Panel */}
        <div className="lg:w-80">
          <NotificationsPanel />
        </div>
      </div>
    </div>
  );
}
