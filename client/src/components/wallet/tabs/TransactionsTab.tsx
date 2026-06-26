import React, { useMemo, useState } from 'react';
import {
  Copy, ArrowUpRight, ArrowDownRight, RefreshCw,
  Filter, Download, ChevronDown,
} from 'lucide-react';
import { WalletTransaction } from '../../../types/wallet';
import GlassCard from '../../common/GlassCard';

interface TransactionsTabProps {
  transactions: WalletTransaction[];
  formatAddress: (address: string) => string;
  formatDate:    (date: string)    => string;
}

const TransactionsTab: React.FC<TransactionsTabProps> = ({
  transactions, formatAddress, formatDate,
}) => {
  const [filterOpen,    setFilterOpen]    = useState(false);
  const [searchTerm,    setSearchTerm]    = useState('');
  const [typeFilter,    setTypeFilter]    = useState<string>('all');
  const [statusFilter,  setStatusFilter]  = useState<string>('all');
  const [fromDate,      setFromDate]      = useState('');
  const [toDate,        setToDate]        = useState('');

  const filteredTransactions = useMemo(() => {
    return transactions.filter(tx => {
      const searchMatch =
        tx.hash.toLowerCase().includes(searchTerm.toLowerCase()) ||
        tx.from.toLowerCase().includes(searchTerm.toLowerCase()) ||
        tx.to.toLowerCase().includes(searchTerm.toLowerCase()) ||
        tx.asset.toLowerCase().includes(searchTerm.toLowerCase());
      const typeMatch   = typeFilter   === 'all' || tx.type   === typeFilter;
      const statusMatch = statusFilter === 'all' || tx.status === statusFilter;
      const txDate = new Date(tx.timestamp);
      const fromMatch = fromDate ? txDate >= new Date(fromDate) : true;
      const toMatch   = toDate   ? txDate <= new Date(`${toDate}T23:59:59.999Z`) : true;
      return searchMatch && typeMatch && statusMatch && fromMatch && toMatch;
    });
  }, [transactions, searchTerm, typeFilter, statusFilter, fromDate, toDate]);

  const handleExportCsv = () => {
    const rows = [
      ['Type','Hash','From','To','Asset','Amount','Gas Used','Gas Price','Status','Date'],
      ...filteredTransactions.map(tx => [
        tx.type, tx.hash, tx.from, tx.to, tx.asset, tx.amount,
        tx.gasUsed || '', tx.gasPrice || '', tx.status, formatDate(tx.timestamp),
      ]),
    ];
    const csv  = rows.map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url  = URL.createObjectURL(blob);
    const link = Object.assign(document.createElement('a'), { href: url, download: 'wallet-transactions.csv' });
    document.body.appendChild(link); link.click();
    document.body.removeChild(link); URL.revokeObjectURL(url);
  };

  const handleCopyHash = async (hash: string) => {
    if (!hash || !navigator?.clipboard) return;
    try { await navigator.clipboard.writeText(hash); } catch { /* silent */ }
  };

  const typeIcon = (type: string) => {
    if (type === 'send')    return <ArrowUpRight   size={14} className="text-red-500"/>;
    if (type === 'receive') return <ArrowDownRight size={14} className="text-secondary"/>;
    return <RefreshCw size={14} className="text-primary"/>;
  };

  const typeBg = (type: string) =>
    type === 'send'    ? 'bg-red-500/20'   :
    type === 'receive' ? 'bg-secondary/20' : 'bg-primary/20';

  const statusPill = (status: string) => (
    <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${
      status === 'completed' ? 'bg-secondary/20 text-secondary' :
      status === 'pending'   ? 'bg-amber-500/20 text-amber-400' :
                               'bg-red-500/20 text-red-400'
    }`}>
      {status.charAt(0).toUpperCase() + status.slice(1)}
    </span>
  );

  return (
    <div className="pt-4">
      <GlassCard className="p-4 sm:p-6">
        {/* Header */}
        <div className="flex flex-wrap justify-between items-start gap-3 mb-5">
          <div>
            <h3 className="text-lg sm:text-xl font-semibold">Transaction History</h3>
            <p className="text-xs text-dark-400 mt-0.5">Live wallet transactions from the server</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              className="btn-outline inline-flex items-center gap-1.5 text-sm px-3 py-1.5"
              onClick={handleExportCsv}
            >
              <Download size={14}/> Export CSV
            </button>
            <button
              className="btn-primary inline-flex items-center gap-1.5 text-sm px-3 py-1.5"
              onClick={() => setFilterOpen(o => !o)}
            >
              <Filter size={14}/> Filter
              <ChevronDown size={13} className={`transition-transform ${filterOpen ? 'rotate-180' : ''}`}/>
            </button>
          </div>
        </div>

        {/* Filter panel */}
        {filterOpen && (
          <div className="mb-5 rounded-xl border border-dark-700 bg-dark-950/40 p-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <label className="space-y-1 text-sm">
              <span className="text-dark-400 text-xs">Search</span>
              <input className="input w-full" type="text" value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)} placeholder="Hash, address or asset"/>
            </label>
            <label className="space-y-1 text-sm">
              <span className="text-dark-400 text-xs">Type</span>
              <select className="input w-full" value={typeFilter} onChange={e => setTypeFilter(e.target.value)}>
                <option value="all">All</option>
                <option value="send">Send</option>
                <option value="receive">Receive</option>
                <option value="transfer">Transfer</option>
                <option value="swap">Swap</option>
                <option value="approve">Approve</option>
              </select>
            </label>
            <label className="space-y-1 text-sm">
              <span className="text-dark-400 text-xs">Status</span>
              <select className="input w-full" value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
                <option value="all">All</option>
                <option value="pending">Pending</option>
                <option value="completed">Completed</option>
                <option value="failed">Failed</option>
              </select>
            </label>
            <div className="grid grid-cols-2 gap-2 sm:col-span-2 xl:col-span-1">
              <label className="space-y-1 text-sm">
                <span className="text-dark-400 text-xs">From</span>
                <input className="input w-full" type="date" value={fromDate} onChange={e => setFromDate(e.target.value)}/>
              </label>
              <label className="space-y-1 text-sm">
                <span className="text-dark-400 text-xs">To</span>
                <input className="input w-full" type="date" value={toDate} onChange={e => setToDate(e.target.value)}/>
              </label>
            </div>
          </div>
        )}

        {/* ── Desktop table (hidden on small screens) ─────────────────────── */}
        <div className="hidden md:block overflow-x-auto rounded-xl">
          <table className="w-full min-w-[800px] text-sm">
            <thead>
              <tr className="border-b border-dark-700">
                {['Type','Hash','From','To','Asset','Amount','Gas','Status','Date'].map(h => (
                  <th key={h} className="py-3 px-3 text-left text-dark-400 text-xs font-medium whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filteredTransactions.map(tx => (
                <tr key={tx.id} className="border-b border-dark-700/50 hover:bg-dark-800/40 transition-colors">
                  <td className="py-3 px-3">
                    <div className="flex items-center gap-2">
                      <div className={`p-1.5 rounded-lg ${typeBg(tx.type)}`}>{typeIcon(tx.type)}</div>
                      <span className="capitalize text-xs font-medium">{tx.type}</span>
                    </div>
                  </td>
                  <td className="py-3 px-3">
                    <div className="flex items-center gap-1 max-w-[120px]">
                      <span className="truncate text-xs font-mono text-dark-300">{tx.hash ? `${tx.hash.slice(0,8)}…` : '—'}</span>
                      {tx.hash && <button onClick={() => handleCopyHash(tx.hash)} className="text-dark-400 hover:text-light flex-shrink-0"><Copy size={11}/></button>}
                    </div>
                  </td>
                  <td className="py-3 px-3 text-xs text-dark-300">{tx.from ? formatAddress(tx.from) : '—'}</td>
                  <td className="py-3 px-3 text-xs text-dark-300">{tx.to   ? formatAddress(tx.to)   : '—'}</td>
                  <td className="py-3 px-3 text-xs font-medium">{tx.asset || '—'}</td>
                  <td className="py-3 px-3 text-xs font-medium">{tx.amount}</td>
                  <td className="py-3 px-3 text-xs text-dark-400 whitespace-nowrap">
                    {tx.gasUsed ? `${tx.gasUsed} gas` : '—'}
                    {tx.gasPrice && <div>{tx.gasPrice} gwei</div>}
                  </td>
                  <td className="py-3 px-3">{statusPill(tx.status)}</td>
                  <td className="py-3 px-3 text-xs text-dark-400 whitespace-nowrap">{formatDate(tx.timestamp)}</td>
                </tr>
              ))}
              {filteredTransactions.length === 0 && (
                <tr><td colSpan={9} className="py-10 text-center text-dark-400 text-sm">
                  {transactions.length === 0
                    ? 'No transactions found. Connect a wallet to see activity.'
                    : 'No transactions match the current filter.'}
                </td></tr>
              )}
            </tbody>
          </table>
        </div>

        {/* ── Mobile card list (shown on small screens) ───────────────────── */}
        <div className="md:hidden space-y-3">
          {filteredTransactions.length === 0 ? (
            <p className="text-center text-dark-400 text-sm py-8">
              {transactions.length === 0
                ? 'No transactions found. Connect a wallet.'
                : 'No transactions match the current filter.'}
            </p>
          ) : filteredTransactions.map(tx => (
            <div key={tx.id} className="bg-dark-800/50 rounded-xl p-4 border border-dark-700 space-y-3">
              {/* Row 1: type + status + date */}
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <div className={`p-1.5 rounded-lg ${typeBg(tx.type)}`}>{typeIcon(tx.type)}</div>
                  <span className="font-semibold text-sm capitalize">{tx.type}</span>
                </div>
                <div className="flex items-center gap-2">
                  {statusPill(tx.status)}
                </div>
              </div>

              {/* Row 2: asset + amount */}
              <div className="flex justify-between text-sm">
                <span className="text-dark-400">Amount</span>
                <span className="font-medium">{tx.amount} {tx.asset}</span>
              </div>

              {/* Row 3: hash */}
              {tx.hash && (
                <div className="flex justify-between items-center text-xs">
                  <span className="text-dark-400">Tx Hash</span>
                  <div className="flex items-center gap-1">
                    <span className="font-mono text-dark-300">{tx.hash.slice(0, 10)}…</span>
                    <button onClick={() => handleCopyHash(tx.hash)} className="text-dark-400 hover:text-light">
                      <Copy size={11}/>
                    </button>
                  </div>
                </div>
              )}

              {/* Row 4: from */}
              {tx.from && (
                <div className="flex justify-between text-xs">
                  <span className="text-dark-400">From</span>
                  <span className="text-dark-300 font-mono">{formatAddress(tx.from)}</span>
                </div>
              )}

              {/* Row 5: to */}
              {tx.to && (
                <div className="flex justify-between text-xs">
                  <span className="text-dark-400">To</span>
                  <span className="text-dark-300 font-mono">{formatAddress(tx.to)}</span>
                </div>
              )}

              {/* Row 6: date */}
              <div className="flex justify-between text-xs">
                <span className="text-dark-400">Date</span>
                <span className="text-dark-300">{formatDate(tx.timestamp)}</span>
              </div>

              {/* Row 7: gas */}
              {(tx.gasUsed || tx.gasPrice) && (
                <div className="flex justify-between text-xs">
                  <span className="text-dark-400">Gas</span>
                  <span className="text-dark-300">
                    {tx.gasUsed && `${tx.gasUsed} gas`}
                    {tx.gasPrice && ` · ${tx.gasPrice} gwei`}
                  </span>
                </div>
              )}
            </div>
          ))}
        </div>
      </GlassCard>
    </div>
  );
};

export default TransactionsTab;