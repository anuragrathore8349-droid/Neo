import React from 'react';
import { Plus, RefreshCw, Download } from 'lucide-react';

interface WalletHeaderProps {
  isConnecting: boolean;
  onConnect:    () => void;
  onExport?:    () => void;
}

const WalletHeader: React.FC<WalletHeaderProps> = ({ isConnecting, onConnect, onExport }) => (
  <div className="flex justify-between items-center mb-6">
    <h2 className="text-2xl font-bold">Wallet Management</h2>
    <div className="flex space-x-2">
      <button
        className="btn-outline flex items-center gap-2"
        onClick={onExport}
        disabled={!onExport}
        title="Export transaction history as CSV"
      >
        <Download size={15} /> Export History
      </button>
      <button
        className="btn-primary flex items-center gap-2"
        onClick={onConnect}
        disabled={isConnecting}
      >
        {isConnecting
          ? <><RefreshCw size={15} className="animate-spin" /> Connecting…</>
          : <><Plus size={15} /> Connect Wallet</>}
      </button>
    </div>
  </div>
);

export default WalletHeader;