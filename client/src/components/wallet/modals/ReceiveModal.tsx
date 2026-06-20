// client/src/components/wallet/modals/ReceiveModal.tsx
import React, { useState, useEffect } from 'react';
import { X, Copy, QrCode as QrIcon } from 'lucide-react';
import { toast } from 'react-toastify';

interface ReceiveModalProps {
  isOpen: boolean;
  onClose: () => void;
  wallet: {
    _id: string;
    name: string;
    address: string;
    network: string;
  };
}

const ReceiveModal: React.FC<ReceiveModalProps> = ({ isOpen, onClose, wallet }) => {
  const [showQr, setShowQr] = useState(false);
  const [qrDataUrl, setQrDataUrl] = useState<string>('');

  useEffect(() => {
    if (!showQr || !window.QRCode) return;

    const generateQr = async () => {
      try {
        // Use QR code library if available, otherwise use simple fallback
        const qrCanvas = document.createElement('canvas');
        // Simple placeholder - in production, use qrcode.react or similar
        setQrDataUrl(`https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(wallet.address)}`);
      } catch (err) {
        console.error('QR generation failed:', err);
      }
    };

    generateQr();
  }, [showQr, wallet.address]);

  const handleCopyAddress = async () => {
    try {
      await navigator.clipboard.writeText(wallet.address);
      toast.success('Address copied!');
    } catch {
      toast.error('Failed to copy address');
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-dark-900 rounded-xl border border-dark-700 max-w-md w-full">
        {/* Header */}
        <div className="border-b border-dark-700 p-4 sm:p-6 flex items-center justify-between">
          <h2 className="text-xl font-bold text-white">Receive Crypto</h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-dark-800 rounded-lg text-dark-400"
          >
            <X size={20} />
          </button>
        </div>

        {/* Content */}
        <div className="p-4 sm:p-6 space-y-6">
          {/* Wallet Info */}
          <div className="bg-dark-800/50 rounded-lg p-4 border border-dark-700">
            <p className="text-dark-400 text-sm mb-2">Wallet</p>
            <p className="font-medium text-white">{wallet.name}</p>
            <p className="text-dark-400 text-sm mt-1">{wallet.network}</p>
          </div>

          {/* Address Display */}
          <div>
            <p className="text-dark-400 text-sm mb-2">Address</p>
            <div className="bg-dark-800 border border-dark-700 rounded-lg p-4">
              <p className="font-mono text-sm text-white break-all">{wallet.address}</p>
              <button
                onClick={handleCopyAddress}
                className="mt-3 flex items-center gap-2 text-sm text-primary hover:text-primary/80 transition"
              >
                <Copy size={16} />
                Copy Address
              </button>
            </div>
          </div>

          {/* QR Code Toggle */}
          <div>
            <button
              onClick={() => setShowQr(!showQr)}
              className="w-full flex items-center gap-2 justify-center py-2 bg-dark-800 hover:bg-dark-700 rounded-lg transition text-white font-medium"
            >
              <QrIcon size={18} />
              {showQr ? 'Hide QR Code' : 'Show QR Code'}
            </button>

            {showQr && qrDataUrl && (
              <div className="mt-4 flex justify-center">
                <img
                  src={qrDataUrl}
                  alt="Wallet QR Code"
                  className="w-40 h-40 border border-dark-700 rounded-lg p-2 bg-white"
                />
              </div>
            )}
          </div>

          {/* Info */}
          <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg p-3">
            <p className="text-sm text-blue-300">
              ✓ Share this address to receive {wallet.network} tokens. Never share your private key.
            </p>
          </div>

          {/* Close Button */}
          <button
            onClick={onClose}
            className="w-full btn-primary py-2.5 font-medium"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};

export default ReceiveModal;
