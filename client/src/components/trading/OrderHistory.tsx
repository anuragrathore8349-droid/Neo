import React, { useState } from 'react';
import {
  ArrowUpRight, ArrowDownLeft, Download,
  Search, ChevronDown, ChevronLeft, ChevronRight, Loader,
} from 'lucide-react';
import GlassCard from '../common/GlassCard';
import { motion } from 'framer-motion';

interface Order {
  id?: string;
  _id?: string;
  asset?: string;
  symbol?: string;
  side: 'buy' | 'sell';
  type: 'market' | 'limit' | 'stop' | 'stop_limit';
  price?: number;
  amount: number;
  total?: number;
  filled?: number;
  filledAmount?: number;
  status: 'open' | 'filled' | 'canceled' | 'cancelled' | 'partial' | 'partially_filled' | 'partially-filled';
  date?: string;
  createdAt?: string;
}

interface OrderHistoryProps {
  orders: Order[];
  showCancelButton?: boolean;
  onCancelOrder?: (orderId: string) => Promise<void>;
  cancellingId?: string | null;
}

const OrderHistory: React.FC<OrderHistoryProps> = ({
  orders,
  showCancelButton = false,
  onCancelOrder,
  cancellingId: externalCancellingId,
}) => {
  const [searchTerm,    setSearchTerm]    = useState('');
  const [statusFilter,  setStatusFilter]  = useState<string | null>(null);
  const [sideFilter,    setSideFilter]    = useState<string | null>(null);
  const [localCancellingId,  setLocalCancellingId]  = useState<string | null>(null);
  const [currentPage,   setCurrentPage]   = useState(1);
  
  // Use external cancellingId if provided, otherwise use local state
  const cancellingId = externalCancellingId ?? localCancellingId;
  const ordersPerPage = 10;

  const handleCancel = async (orderId: string) => {
    if (!onCancelOrder) return;
    setLocalCancellingId(orderId);
    try { await onCancelOrder(orderId); }
    finally { setLocalCancellingId(null); }
  };

  const filteredOrders = orders.filter(order => {
    const label = (order.asset || order.symbol || '').toString();
    const matchesSearch  = searchTerm === '' || label.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus  = statusFilter === null || order.status === statusFilter;
    const matchesSide    = sideFilter   === null || order.side   === sideFilter;
    return matchesSearch && matchesStatus && matchesSide;
  });

  const sortedOrders = [...filteredOrders].sort(
    (a, b) =>
      new Date(b.date || b.createdAt || 0).getTime() -
      new Date(a.date || a.createdAt || 0).getTime()
  );

  const indexOfLast  = currentPage * ordersPerPage;
  const indexOfFirst = indexOfLast  - ordersPerPage;
  const currentOrders = sortedOrders.slice(indexOfFirst, indexOfLast);
  const totalPages    = Math.ceil(sortedOrders.length / ordersPerPage);

  const formatCurrency = (value: number) =>
    new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2 }).format(value);

  const formatDate = (dateString: string | Date | undefined) => {
    if (!dateString) return 'N/A';
    try {
      const d = new Date(dateString);
      if (isNaN(d.getTime())) return 'Invalid Date';
      return d.toLocaleDateString('en-US', {
        month: 'short', day: 'numeric', year: 'numeric',
        hour: '2-digit', minute: '2-digit',
      });
    } catch { return 'Invalid Date'; }
  };

  const isPartial = (status: string) =>
    ['partial', 'partially_filled', 'partially-filled'].includes(status);

  const isCancellable = (status: string) =>
    ['open', 'partially_filled', 'partially-filled'].includes(status);

  const statusBadge = (status: string) => {
    if (status === 'filled')         return 'bg-secondary/20 text-secondary';
    if (status === 'open')           return 'bg-primary/20 text-primary';
    if (isPartial(status))           return 'bg-amber-500/20 text-amber-500';
    return 'bg-red-500/20 text-red-500';
  };

  const statusLabel = (status: string) => {
    if (isPartial(status)) return 'Partial';
    return status.charAt(0).toUpperCase() + status.slice(1);
  };

  return (
    <GlassCard className="p-6">
      {/* ── Controls ──────────────────────────────────────────────────────── */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
        <h3 className="text-xl font-semibold">Order History</h3>

        <div className="flex flex-wrap gap-2 w-full md:w-auto">
          <div className="relative flex-1 min-w-[140px]">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-dark-400" />
            <input
              type="text"
              placeholder="Search assets..."
              className="input-field pl-10 w-full"
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
            />
          </div>

          <div className="relative">
            <select
              className="input-field appearance-none pr-8"
              value={statusFilter || ''}
              onChange={e => setStatusFilter(e.target.value === '' ? null : e.target.value)}
            >
              <option value="">All Status</option>
              <option value="open">Open</option>
              <option value="filled">Filled</option>
              <option value="canceled">Canceled</option>
              <option value="partially_filled">Partial</option>
            </select>
            <ChevronDown size={14} className="absolute right-2 top-1/2 -translate-y-1/2 text-dark-400 pointer-events-none" />
          </div>

          <div className="relative">
            <select
              className="input-field appearance-none pr-8"
              value={sideFilter || ''}
              onChange={e => setSideFilter(e.target.value === '' ? null : e.target.value)}
            >
              <option value="">All Sides</option>
              <option value="buy">Buy</option>
              <option value="sell">Sell</option>
            </select>
            <ChevronDown size={14} className="absolute right-2 top-1/2 -translate-y-1/2 text-dark-400 pointer-events-none" />
          </div>

          <button className="p-2 rounded-lg bg-dark-800 text-dark-400 hover:text-light">
            <Download size={18} />
          </button>
        </div>
      </div>

      {/* ── Table
           KEY FIX: no min-w-[800px] — responsive column hiding instead ── */}
      <div className="w-full overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-dark-700">
              {/* Date hidden on xs */}
              <th className="hidden sm:table-cell text-left py-3 px-3 text-dark-400 text-xs font-medium">Date</th>
              <th className="text-left py-3 px-3 text-dark-400 text-xs font-medium">Pair</th>
              {/* Type hidden on xs */}
              <th className="hidden sm:table-cell text-left py-3 px-3 text-dark-400 text-xs font-medium">Type</th>
              <th className="text-left py-3 px-3 text-dark-400 text-xs font-medium">Side</th>
              <th className="text-right py-3 px-3 text-dark-400 text-xs font-medium">Price</th>
              {/* Amount hidden on xs */}
              <th className="hidden md:table-cell text-right py-3 px-3 text-dark-400 text-xs font-medium">Amount</th>
              {/* Filled hidden on sm and below */}
              <th className="hidden lg:table-cell text-right py-3 px-3 text-dark-400 text-xs font-medium">Filled</th>
              <th className="text-right py-3 px-3 text-dark-400 text-xs font-medium">Total</th>
              <th className="text-center py-3 px-3 text-dark-400 text-xs font-medium">Status</th>
              {showCancelButton && (
                <th className="text-center py-3 px-3 text-dark-400 text-xs font-medium">Action</th>
              )}
            </tr>
          </thead>
          <tbody>
            {currentOrders.map(order => {
              const filledAmount = order.filledAmount ?? order.filled ?? 0;
              const orderId      = order.id || order._id || '';
              return (
                <motion.tr
                  key={orderId}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ duration: 0.2 }}
                  className="border-b border-dark-700/50 hover:bg-dark-800/40"
                >
                  <td className="hidden sm:table-cell py-3 px-3 text-xs text-dark-400">
                    {formatDate(order.date || order.createdAt)}
                  </td>
                  <td className="py-3 px-3 font-medium text-sm">
                    {(order.asset || order.symbol || '').toString()}
                  </td>
                  <td className="hidden sm:table-cell py-3 px-3 capitalize text-sm text-dark-300">
                    {order.type || 'N/A'}
                  </td>
                  <td className="py-3 px-3">
                    <div className="flex items-center gap-1">
                      <div className={`p-1 rounded ${order.side === 'buy' ? 'bg-secondary/20' : 'bg-red-500/20'}`}>
                        {order.side === 'buy'
                          ? <ArrowDownLeft size={12} className="text-secondary" />
                          : <ArrowUpRight  size={12} className="text-red-500"   />}
                      </div>
                      <span className={`text-xs capitalize ${order.side === 'buy' ? 'text-secondary' : 'text-red-500'}`}>
                        {order.side}
                      </span>
                    </div>
                  </td>
                  <td className="py-3 px-3 text-right text-sm">
                    {order.price ? formatCurrency(order.price) : 'Market'}
                  </td>
                  <td className="hidden md:table-cell py-3 px-3 text-right text-sm">
                    {order.amount ?? 0}
                  </td>
                  <td className="hidden lg:table-cell py-3 px-3 text-right text-sm text-dark-300">
                    {filledAmount} ({order.amount ? Math.round((filledAmount / order.amount) * 100) : 0}%)
                  </td>
                  <td className="py-3 px-3 text-right text-sm font-medium">
                    {formatCurrency(order.total ?? ((order.price || 0) * (order.amount || 0)))}
                  </td>
                  <td className="py-3 px-3 text-center">
                    <span className={`px-2 py-0.5 rounded-full text-xs ${statusBadge(order.status)}`}>
                      {statusLabel(order.status)}
                    </span>
                  </td>
                  {showCancelButton && (
                    <td className="py-3 px-3 text-center">
                      {isCancellable(order.status) && (
                        <button
                          onClick={e => { e.stopPropagation(); handleCancel(orderId); }}
                          disabled={cancellingId === orderId}
                          className="px-2 py-1 text-xs rounded-lg bg-red-500/20 text-red-400 hover:bg-red-500/40 transition-all disabled:opacity-50"
                        >
                          {cancellingId === orderId ? <Loader size={12} className="animate-spin" /> : 'Cancel'}
                        </button>
                      )}
                    </td>
                  )}
                </motion.tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {sortedOrders.length === 0 && (
        <div className="text-center py-8">
          <p className="text-dark-400">No orders found matching your filters.</p>
        </div>
      )}

      {sortedOrders.length > 0 && (
        <div className="mt-4 flex justify-between items-center flex-wrap gap-2">
          <p className="text-dark-400 text-xs">
            {indexOfFirst + 1}–{Math.min(indexOfLast, sortedOrders.length)} of {sortedOrders.length}
          </p>
          <div className="flex items-center gap-2">
            <button
              className="p-1.5 rounded-lg bg-dark-800 text-dark-400 hover:text-light disabled:opacity-40"
              onClick={() => setCurrentPage(p => p - 1)}
              disabled={currentPage === 1}
            >
              <ChevronLeft size={14} />
            </button>
            <span className="text-xs text-dark-300 px-2">
              {currentPage} / {totalPages}
            </span>
            <button
              className="p-1.5 rounded-lg bg-dark-800 text-dark-400 hover:text-light disabled:opacity-40"
              onClick={() => setCurrentPage(p => p + 1)}
              disabled={currentPage === totalPages}
            >
              <ChevronRight size={14} />
            </button>
          </div>
        </div>
      )}
    </GlassCard>
  );
};

export default OrderHistory;
