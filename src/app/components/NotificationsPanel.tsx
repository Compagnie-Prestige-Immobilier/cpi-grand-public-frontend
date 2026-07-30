import { Bell, CheckCircle2, AlertCircle, Clock, TrendingUp } from 'lucide-react';
import { motion } from 'motion/react';

const mockNotifications = [
  {
    id: '1',
    type: 'success',
    title: 'Payment Confirmed',
    message: 'TechParts Manufacturing settlement confirmed via SWIFT gpi',
    time: '2 minutes ago',
    unread: true,
  },
  {
    id: '2',
    type: 'progress',
    title: 'In Progress',
    message: 'Global Spice Exports payment is being processed (65% complete)',
    time: '15 minutes ago',
    unread: true,
  },
  {
    id: '3',
    type: 'info',
    title: 'New Investment',
    message: 'Your investment in Eco Crafts Ltd. has been initiated',
    time: '1 hour ago',
    unread: false,
  },
  {
    id: '4',
    type: 'success',
    title: 'Escrow Released',
    message: '$50,000 automatically released to Artisan Textiles Co.',
    time: '3 hours ago',
    unread: false,
  },
  {
    id: '5',
    type: 'trending',
    title: 'Return Credited',
    message: 'Received $8,500 return from completed investment',
    time: 'Yesterday',
    unread: false,
  },
];

export default function NotificationsPanel() {
  const getNotificationIcon = (type: string) => {
    switch (type) {
      case 'success':
        return <CheckCircle2 className="w-5 h-5 text-emerald-600" />;
      case 'progress':
        return <Clock className="w-5 h-5 text-blue-600" />;
      case 'trending':
        return <TrendingUp className="w-5 h-5 text-purple-600" />;
      default:
        return <AlertCircle className="w-5 h-5 text-slate-600" />;
    }
  };

  const getNotificationBg = (type: string, unread: boolean) => {
    const base = unread ? '' : 'opacity-75';
    switch (type) {
      case 'success':
        return `bg-emerald-50 border-emerald-200 ${base}`;
      case 'progress':
        return `bg-blue-50 border-blue-200 ${base}`;
      case 'trending':
        return `bg-purple-50 border-purple-200 ${base}`;
      default:
        return `bg-slate-50 border-slate-200 ${base}`;
    }
  };

  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden sticky top-24">
      {/* Header */}
      <div className="px-6 py-4 border-b border-slate-200 bg-gradient-to-r from-slate-50 to-white">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Bell className="w-5 h-5 text-slate-700" />
            <h3 className="text-slate-900">Notifications</h3>
          </div>
          <div className="w-6 h-6 bg-blue-600 text-white rounded-full flex items-center justify-center text-xs">
            2
          </div>
        </div>
      </div>

      {/* Notifications List */}
      <div className="max-h-[calc(100vh-16rem)] overflow-y-auto">
        <div className="p-4 space-y-3">
          {mockNotifications.map((notification, index) => (
            <motion.div
              key={notification.id}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: index * 0.05 }}
              className={`p-4 rounded-lg border cursor-pointer hover:shadow-md transition-all duration-200 ${getNotificationBg(notification.type, notification.unread)}`}
            >
              <div className="flex items-start gap-3">
                <div className="mt-0.5">
                  {getNotificationIcon(notification.type)}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2 mb-1">
                    <p className="text-sm text-slate-900">
                      {notification.title}
                    </p>
                    {notification.unread && (
                      <div className="w-2 h-2 bg-blue-600 rounded-full flex-shrink-0 mt-1" />
                    )}
                  </div>
                  <p className="text-xs text-slate-600 mb-2 line-clamp-2">
                    {notification.message}
                  </p>
                  <p className="text-xs text-slate-500">{notification.time}</p>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      </div>

      {/* Footer */}
      <div className="px-6 py-3 border-t border-slate-200 bg-slate-50">
        <button className="w-full text-sm text-blue-600 hover:text-blue-700 transition-colors">
          View All Notifications
        </button>
      </div>
    </div>
  );
}
