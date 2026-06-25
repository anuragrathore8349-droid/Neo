// client/src/components/Portfolio/AddAssetModal.tsx — REPLACE ENTIRE FILE
import React, { useState } from 'react';
import Modal from '../common/Modal';
import { addAsset } from '../../services/portfolio.service';
import { toast } from 'react-toastify';

interface AddAssetModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAssetAdded: () => void;
  initialAsset?: {
    symbol: string;
    name?: string;
    type?: string;
  } | null;
}

const AddAssetModal: React.FC<AddAssetModalProps> = ({ isOpen, onClose, onAssetAdded, initialAsset }) => {
  const [form, setForm] = useState({
    symbol: '', name: '', type: 'crypto' as const,
    amount: '', costBasis: '', purchaseDate: '',
  });

  React.useEffect(() => {
    if (isOpen && initialAsset) {
      setForm(prev => ({
        ...prev,
        symbol: initialAsset.symbol.toUpperCase(),
        name: initialAsset.name || initialAsset.symbol.toUpperCase(),
        type: (initialAsset.type as any) || 'crypto',
      }));
    }
  }, [isOpen, initialAsset]);
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState<string | null>(null);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    setForm(prev => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!form.symbol || !form.amount || !form.costBasis) {
      setError('Symbol, amount, and cost basis are required.');
      return;
    }
    setLoading(true);
    try {
      await addAsset({
        symbol:       form.symbol.toUpperCase(),
        name:         form.name || form.symbol.toUpperCase(),
        type:         form.type,
        amount:       parseFloat(form.amount),
        costBasis:    parseFloat(form.costBasis),
        purchaseDate: form.purchaseDate || undefined,
      });
      toast.success(`${form.symbol.toUpperCase()} added to portfolio`);
      onAssetAdded();
      onClose();
      setForm({ symbol:'', name:'', type:'crypto', amount:'', costBasis:'', purchaseDate:'' });
    } catch (err: any) {
      setError(err.message || 'Failed to add asset');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Add Asset">
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && <div className="text-red-400 text-sm">{error}</div>}

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="text-sm text-dark-300 mb-1 block">Symbol *</label>
            <input name="symbol" value={form.symbol} onChange={handleChange}
              placeholder="BTC, ETH, AAPL..."
              className="w-full bg-dark-700 border border-dark-600 rounded px-3 py-2 text-sm text-white uppercase" />
          </div>
          <div>
            <label className="text-sm text-dark-300 mb-1 block">Name</label>
            <input name="name" value={form.name} onChange={handleChange}
              placeholder="Bitcoin"
              className="w-full bg-dark-700 border border-dark-600 rounded px-3 py-2 text-sm text-white" />
          </div>
        </div>

        <div>
          <label className="text-sm text-dark-300 mb-1 block">Asset Type</label>
          <select name="type" value={form.type} onChange={handleChange}
            className="w-full bg-dark-700 border border-dark-600 rounded px-3 py-2 text-sm text-white">
            <option value="crypto">Crypto</option>
            <option value="stock">Stock</option>
            <option value="forex">Forex</option>
            <option value="commodity">Commodity</option>
          </select>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="text-sm text-dark-300 mb-1 block">Amount (Quantity) *</label>
            <input name="amount" type="number" step="any" min="0" value={form.amount} onChange={handleChange}
              placeholder="0.5"
              className="w-full bg-dark-700 border border-dark-600 rounded px-3 py-2 text-sm text-white" />
          </div>
          <div>
            <label className="text-sm text-dark-300 mb-1 block">Avg Buy Price (USD) *</label>
            <input name="costBasis" type="number" step="any" min="0" value={form.costBasis} onChange={handleChange}
              placeholder="42000"
              className="w-full bg-dark-700 border border-dark-600 rounded px-3 py-2 text-sm text-white" />
          </div>
        </div>

        <div>
          <label className="text-sm text-dark-300 mb-1 block">Purchase Date</label>
          <input name="purchaseDate" type="date" value={form.purchaseDate} onChange={handleChange}
            className="w-full bg-dark-700 border border-dark-600 rounded px-3 py-2 text-sm text-white" />
        </div>

        <div className="flex justify-end gap-3 pt-2">
          <button type="button" onClick={onClose}
            className="px-4 py-2 rounded bg-dark-600 text-dark-200 text-sm hover:bg-dark-500">
            Cancel
          </button>
          <button type="submit" disabled={loading}
            className="px-4 py-2 rounded bg-primary text-white text-sm hover:bg-primary/90 disabled:opacity-50">
            {loading ? 'Adding...' : 'Add Asset'}
          </button>
        </div>
      </form>
    </Modal>
  );
};

export default AddAssetModal;
