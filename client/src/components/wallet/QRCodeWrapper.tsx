import React, { useState, useEffect, useRef } from 'react';
import { Loader } from 'lucide-react';

interface QRCodeWrapperProps {
  value: string;
  size?: number;
  level?: 'L' | 'M' | 'Q' | 'H';
  includeMargin?: boolean;
  fgColor?: string;
  bgColor?: string;
}

/**
 * QRCode wrapper using a web-based QR code API
 * Avoids CommonJS module resolution issues by generating QR as image
 */
const QRCodeWrapper: React.FC<QRCodeWrapperProps> = ({ 
  value, 
  size = 256, 
  level = 'H', 
  includeMargin = true, 
  fgColor = '#ffffff', 
  bgColor = '#1a1a2e' 
}) => {
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    let mounted = true;

    const generateQR = async () => {
      try {
        setLoading(true);
        setError(null);

        // Try to load qrcode library for client-side generation
        try {
          const QR = await import('qrcode');
          if (!mounted) return;

          const canvas = document.createElement('canvas');
          await QR.toCanvas(canvas, value, {
            width: size,
            margin: includeMargin ? 2 : 0,
            color: {
              dark: fgColor,
              light: bgColor,
            },
            errorCorrectionLevel: level,
          });

          setQrDataUrl(canvas.toDataURL('image/png'));
        } catch (libError) {
          // Fallback: use QR code API service
          if (!mounted) return;
          console.warn('qrcode library load failed, using API fallback:', libError);

          const encodedValue = encodeURIComponent(value);
          const apiUrl = `https://api.qrserver.com/v1/create-qr-code/?size=${size}x${size}&data=${encodedValue}&color=${fgColor.replace('#', '')}&bgcolor=${bgColor.replace('#', '')}`;
          
          setQrDataUrl(apiUrl);
        }
      } catch (err: any) {
        if (mounted) {
          setError(err?.message || 'Failed to generate QR code');
          console.error('QR code generation error:', err);
        }
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    };

    generateQR();

    return () => { mounted = false; };
  }, [value, size, level, includeMargin, fgColor, bgColor]);

  if (loading) {
    return (
      <div className="w-64 h-64 flex flex-col items-center justify-center bg-dark-800/50 rounded-lg p-4">
        <Loader className="w-8 h-8 animate-spin text-primary mb-2" />
        <div className="text-dark-400 text-sm">Generating QR Code...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="w-64 h-64 flex items-center justify-center bg-dark-800/50 rounded-lg p-4">
        <div className="text-center">
          <div className="text-red-400 text-sm mb-2">Error</div>
          <div className="text-dark-400 text-xs">{error}</div>
        </div>
      </div>
    );
  }

  if (!qrDataUrl) {
    return (
      <div className="w-64 h-64 flex items-center justify-center bg-dark-800/50 rounded-lg p-4">
        <div className="text-dark-400 text-sm">QR code unavailable</div>
      </div>
    );
  }

  return (
    <div className="flex justify-center">
      <img 
        src={qrDataUrl} 
        alt={`QR Code for ${value}`}
        style={{ width: size, height: size }}
        className="border border-dark-600 rounded-lg"
      />
    </div>
  );
};

export default QRCodeWrapper;
