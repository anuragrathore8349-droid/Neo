import React from 'react';
import { WalletIcon, Copy, QrCode, ExternalLink } from 'lucide-react';
import { getNetworkName } from '../../utils/network';

interface ConnectedWalletProps {
  wallet: {
    _id: string; name: string;
    type: 'exchange' | 'defi' | 'external';
    provider: string; address: string; network: string; isVerified: boolean;
    balances?: { assetId: string; symbol: string; amount: number }[];
  };
  formatAddress: (address: string) => string;
  currentChainId?: string | null;
  /** Live USD prices keyed by symbol e.g. { ETH: 2400, BTC: 77000 } */
  assetPrices?: Record<string, number>;
  onCopy?:     (address: string) => void;
  onQr?:       (wallet: any) => void;
  onExplorer?: (wallet: any) => void;
  onSend?:     (wallet: any) => void;
  onReceive?:  (wallet: any) => void;
}

const ConnectedWallet: React.FC<ConnectedWalletProps> = ({
  wallet, formatAddress, currentChainId, assetPrices = {},
  onCopy, onQr, onExplorer, onSend, onReceive,
}) => {
  const displayNetwork =
    wallet.type === 'external' && currentChainId
      ? getNetworkName(currentChainId)
      : wallet.network;

  const primary   = wallet.balances?.[0];
  const livePrice = primary ? (assetPrices[primary.symbol] ?? 0) : 0;
  const usdValue  = primary ? primary.amount * livePrice : 0;

  const fmtUsd = (v: number) =>
    new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(v);

  return (
    <div className="bg-dark-800/50 rounded-lg p-4 border border-dark-700">
      <div className="flex justify-between items-start">
        <div className="flex items-center">
          <div className="bg-primary/20 p-2 rounded-lg mr-3">
            <WalletIcon size={20} className="text-primary" />
          </div>
          <div>
            <p className="font-medium">{wallet.name || wallet.provider}</p>
            <p className="text-dark-400 text-sm font-mono">{formatAddress(wallet.address)}</p>
            {wallet.isVerified && <span className="text-xs text-secondary">✓ Verified</span>}
          </div>
        </div>
        <div className="flex space-x-1">
          <button onClick={() => onCopy?.(wallet.address)}   className="p-2 rounded-lg hover:bg-dark-700 text-dark-400 hover:text-light" title="Copy"><Copy size={15}/></button>
          <button onClick={() => onQr?.(wallet)}             className="p-2 rounded-lg hover:bg-dark-700 text-dark-400 hover:text-light" title="QR"><QrCode size={15}/></button>
          <button onClick={() => onExplorer?.(wallet)}       className="p-2 rounded-lg hover:bg-dark-700 text-dark-400 hover:text-light" title="Explorer"><ExternalLink size={15}/></button>
        </div>
      </div>

      <div className="mt-4 grid grid-cols-3 gap-4">
        <div>
          <p className="text-dark-400 text-xs">Balance</p>
          <p className="font-medium text-sm">{primary ? `${primary.amount.toFixed(6)} ${primary.symbol}` : '—'}</p>
          <p className="text-dark-400 text-xs">
            {primary ? (livePrice > 0 ? fmtUsd(usdValue) : 'Price loading…') : '$0.00'}
          </p>
        </div>
        <div>
          <p className="text-dark-400 text-xs">Network</p>
          <p className="font-medium text-sm">{displayNetwork || '—'}</p>
          <p className="text-secondary text-xs">Connected</p>
        </div>
        <div>
          <p className="text-dark-400 text-xs">Type</p>
          <p className="font-medium text-sm capitalize">{wallet.type}</p>
          <p className="text-dark-400 text-xs">{wallet.provider}</p>
        </div>
      </div>

      <div className="mt-4 flex space-x-2">
        <button className="btn-primary flex-1 text-sm py-2"  onClick={() => onSend?.(wallet)}>Send</button>
        <button className="btn-outline flex-1 text-sm py-2"  onClick={() => onReceive?.(wallet)}>Receive</button>
      </div>
    </div>
  );
};

export default ConnectedWallet;