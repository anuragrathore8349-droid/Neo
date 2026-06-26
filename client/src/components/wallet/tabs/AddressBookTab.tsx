// FILE: src/components/wallet/tabs/AddressBookTab.tsx
import React, { useState } from 'react';
import { Book, Copy, ExternalLink, Trash2 } from 'lucide-react';
import { toast } from 'react-toastify';
import { AddressBookEntry } from '../../../types/wallet';
import GlassCard from '../../common/GlassCard';

interface AddressBookTabProps {
  addressBook:      AddressBookEntry[];
  formatAddress:    (address: string) => string;
  onAddAddress?:    (address: Omit<AddressBookEntry, 'id'>) => Promise<void> | void;
  onDeleteAddress?: (id: string) => Promise<void> | void;
  isAdding?:        boolean;
  error?:           string | null;
  onDismissError?:  () => void;
}

const NETWORKS = ['Ethereum', 'Polygon', 'Arbitrum', 'Optimism', 'Base', 'BSC', 'Avalanche', 'Solana'];

const AddressBookTab: React.FC<AddressBookTabProps> = ({
  addressBook, formatAddress,
  onAddAddress, onDeleteAddress,
  isAdding = false, error, onDismissError,
}) => {
  const [formData, setFormData] = useState({ name: '', address: '', network: 'Ethereum', notes: '' });
  const [isSubmitting, setIsSubmitting]   = useState(false);
  const [deletingId,   setDeletingId]     = useState<string | null>(null);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim() || !formData.address.trim()) return;
    setIsSubmitting(true);
    try {
      await onAddAddress?.({
        name:    formData.name.trim(),
        address: formData.address.trim(),
        network: formData.network,
        notes:   formData.notes.trim() || undefined,
      });
      setFormData({ name: '', address: '', network: 'Ethereum', notes: '' });
    } catch { /* error shown by parent */ }
    finally { setIsSubmitting(false); }
  };

  const handleCopy = async (address: string) => {
    try { await navigator.clipboard.writeText(address); toast.success('Address copied'); }
    catch { toast.error('Could not copy address'); }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('Remove this address from your address book?')) return;
    setDeletingId(id);
    try { await onDeleteAddress?.(id); }
    catch { toast.error('Failed to delete address'); }
    finally { setDeletingId(null); }
  };

  const handleOpenExplorer = (address: string, network: string) => {
    const key = (network || '').toLowerCase();
    let base  = 'https://etherscan.io/address/';
    if (key.includes('polygon'))  base = 'https://polygonscan.com/address/';
    if (key.includes('bsc'))      base = 'https://bscscan.com/address/';
    if (key.includes('arbitrum')) base = 'https://arbiscan.io/address/';
    if (key.includes('optimism')) base = 'https://optimistic.etherscan.io/address/';
    if (key.includes('base'))     base = 'https://basescan.org/address/';
    window.open(`${base}${address}`, '_blank');
  };

  return (
    <div className="pt-6">
      {error && (
        <div className="mb-4 rounded-xl border border-red-600 bg-red-950/60 p-4 text-sm text-red-100">
          <div className="flex justify-between items-start">
            <div>
              <p className="font-medium">Error adding address</p>
              <p>{error}</p>
            </div>
            {onDismissError && (
              <button onClick={onDismissError} className="text-red-300 hover:text-red-100">×</button>
            )}
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <GlassCard className="p-6">
            <h3 className="text-xl font-semibold mb-6">Address Book</h3>
            <div className="space-y-4">
              {addressBook.length === 0 && (
                <p className="text-center text-dark-400 py-8">No addresses saved yet. Add one using the form on the right.</p>
              )}
              {addressBook.map(entry => (
                <div key={entry.id} className="bg-dark-800/50 rounded-lg p-4 hover:bg-dark-800 transition-all">
                  <div className="flex justify-between items-start">
                    <div className="flex items-center flex-1 min-w-0">
                      <div className="bg-primary/20 p-2 rounded-lg mr-3 flex-shrink-0">
                        <Book size={18} className="text-primary" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium truncate">{entry.name}</p>
                        <div className="flex items-center mt-1">
                          <p className="text-dark-400 text-sm font-mono">{formatAddress(entry.address)}</p>
                          {/* ✅ Fixed: copy button now has handler */}
                          <button onClick={() => handleCopy(entry.address)} className="ml-2 text-dark-400 hover:text-light" title="Copy address">
                            <Copy size={14} />
                          </button>
                        </div>
                        <div className="mt-2 flex items-center gap-4 flex-wrap">
                          <span className="text-dark-400 text-xs">Network: <span className="text-light">{entry.network}</span></span>
                          {entry.notes && (
                            <span className="text-dark-400 text-xs">Notes: <span className="text-light">{entry.notes}</span></span>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="flex space-x-1 flex-shrink-0 ml-2">
                      {/* ✅ Fixed: explorer button navigates to block explorer */}
                      <button
                        onClick={() => handleOpenExplorer(entry.address, entry.network)}
                        className="p-2 rounded-lg hover:bg-dark-700 transition-all text-dark-400 hover:text-light"
                        title="View on explorer"
                      >
                        <ExternalLink size={16} />
                      </button>
                      {/* ✅ Fixed: delete button now has handler */}
                      <button
                        onClick={() => handleDelete(entry.id)}
                        disabled={deletingId === entry.id}
                        className="p-2 rounded-lg hover:bg-dark-700 transition-all text-dark-400 hover:text-red-400 disabled:opacity-50"
                        title="Delete address"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </GlassCard>
        </div>

        <div>
          <GlassCard className="p-6 sticky top-6">
            <h3 className="text-lg font-semibold mb-4">Add Address</h3>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-dark-200 mb-2">Address Name</label>
                <input type="text" name="name" value={formData.name} onChange={handleInputChange}
                  placeholder="e.g., My Exchange"
                  className="w-full bg-dark-800 border border-dark-700 rounded-lg px-3 py-2 text-light placeholder-dark-500 focus:outline-none focus:border-primary"
                  disabled={isSubmitting || isAdding} />
              </div>
              <div>
                <label className="block text-sm font-medium text-dark-200 mb-2">Wallet Address</label>
                <input type="text" name="address" value={formData.address} onChange={handleInputChange}
                  placeholder="0x..."
                  className="w-full bg-dark-800 border border-dark-700 rounded-lg px-3 py-2 text-light placeholder-dark-500 focus:outline-none focus:border-primary font-mono"
                  disabled={isSubmitting || isAdding} />
              </div>
              <div>
                <label className="block text-sm font-medium text-dark-200 mb-2">Network</label>
                <select name="network" value={formData.network} onChange={handleInputChange}
                  className="w-full bg-dark-800 border border-dark-700 rounded-lg px-3 py-2 text-light focus:outline-none focus:border-primary"
                  disabled={isSubmitting || isAdding}>
                  {NETWORKS.map(n => <option key={n}>{n}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-dark-200 mb-2">Notes (Optional)</label>
                <textarea name="notes" value={formData.notes} onChange={handleInputChange}
                  placeholder="Add any notes..."
                  className="w-full bg-dark-800 border border-dark-700 rounded-lg px-3 py-2 text-light placeholder-dark-500 focus:outline-none focus:border-primary resize-none"
                  rows={3} disabled={isSubmitting || isAdding} />
              </div>
              <button type="submit"
                disabled={isSubmitting || isAdding || !formData.name.trim() || !formData.address.trim()}
                className="w-full btn-primary disabled:opacity-50 disabled:cursor-not-allowed">
                {isSubmitting || isAdding ? 'Adding…' : 'Add Address'}
              </button>
            </form>
          </GlassCard>
        </div>
      </div>
    </div>
  );
};

export default AddressBookTab;