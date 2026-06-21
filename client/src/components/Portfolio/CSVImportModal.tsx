import React, { useState } from 'react';
import { Upload, AlertCircle, CheckCircle, Loader, Download, X } from 'lucide-react';
import Modal from '../../components/common/Modal';
import { importAssetsFromCSV, CSVImportResult } from '../../services/portfolio.service';

interface CSVImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onImportSuccess: () => void;
}

const CSVImportModal: React.FC<CSVImportModalProps> = ({ isOpen, onClose, onImportSuccess }) => {
  const [isDragging, setIsDragging] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string>('');
  const [result, setResult] = useState<CSVImportResult | null>(null);

  const downloadTemplate = () => {
    const template = `symbol,amount,purchase price,purchase date,type,name,notes
BTC,0.5,45000,2024-01-15,crypto,Bitcoin,Initial purchase
ETH,2,2500,2024-01-20,crypto,Ethereum,DCA investment
AAPL,10,150,2024-02-01,stock,Apple Inc.,From retirement account
MSFT,5,380,2024-02-05,stock,Microsoft,Tech diversification
`;

    const blob = new Blob([template], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'portfolio_import_template.csv';
    document.body.appendChild(a);
    a.click();
    window.URL.revokeObjectURL(url);
    document.body.removeChild(a);
  };

  const handleDragEnter = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    const files = e.dataTransfer.files;
    if (files.length > 0) {
      const file = files[0];
      if (file.name.endsWith('.csv')) {
        setSelectedFile(file);
        setError('');
        setResult(null);
      } else {
        setError('Please select a CSV file');
      }
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      const file = files[0];
      if (file.name.endsWith('.csv')) {
        setSelectedFile(file);
        setError('');
        setResult(null);
      } else {
        setError('Please select a CSV file');
      }
    }
  };

  const handleImport = async () => {
    if (!selectedFile) {
      setError('Please select a file');
      return;
    }

    setIsLoading(true);
    setError('');

    try {
      const response = await importAssetsFromCSV(selectedFile);
      if (response.status === 'success' && response.data) {
        setResult(response.data);
        setTimeout(() => {
          onImportSuccess();
          handleClose();
        }, 2000);
      } else {
        setError(response.message || 'Import failed');
      }
    } catch (err: any) {
      setError(err.message || 'Failed to import CSV');
    } finally {
      setIsLoading(false);
    }
  };

  const handleClose = () => {
    setSelectedFile(null);
    setError('');
    setResult(null);
    onClose();
  };

  return (
    <Modal isOpen={isOpen} onClose={handleClose} size="lg">
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold text-white">Import Portfolio Assets</h2>
            <p className="text-sm text-dark-400 mt-1">Upload a CSV file to bulk import your assets</p>
          </div>
          <button
            onClick={handleClose}
            className="text-dark-400 hover:text-white transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Template Info */}
        <div className="bg-blue-900/20 border border-blue-700/50 rounded-lg p-4">
          <div className="flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-blue-400 flex-shrink-0 mt-0.5" />
            <div>
              <h3 className="text-sm font-semibold text-blue-400">CSV Format</h3>
              <p className="text-xs text-blue-300/80 mt-1">
                Required columns: <code className="bg-blue-950 px-1.5 py-0.5 rounded">symbol</code>, 
                <code className="bg-blue-950 px-1.5 py-0.5 rounded ml-1">amount</code>, 
                <code className="bg-blue-950 px-1.5 py-0.5 rounded ml-1">purchase price</code>, 
                <code className="bg-blue-950 px-1.5 py-0.5 rounded ml-1">purchase date</code>
              </p>
              <p className="text-xs text-blue-300/80 mt-2">
                Optional columns: <code className="bg-blue-950 px-1.5 py-0.5 rounded">type</code>, 
                <code className="bg-blue-950 px-1.5 py-0.5 rounded ml-1">name</code>, 
                <code className="bg-blue-950 px-1.5 py-0.5 rounded ml-1">notes</code>
              </p>
              <button
                onClick={downloadTemplate}
                className="mt-3 inline-flex items-center gap-2 text-xs bg-blue-700 hover:bg-blue-600 text-white px-3 py-1.5 rounded transition-colors"
              >
                <Download className="w-4 h-4" />
                Download Template
              </button>
            </div>
          </div>
        </div>

        {/* File Upload Area */}
        {!result && (
          <div
            onDragEnter={handleDragEnter}
            onDragLeave={handleDragLeave}
            onDragOver={handleDragOver}
            onDrop={handleDrop}
            className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
              isDragging
                ? 'border-primary bg-primary/10'
                : selectedFile
                  ? 'border-green-500 bg-green-500/10'
                  : 'border-dark-500 hover:border-dark-400 bg-dark-800/50'
            }`}
          >
            <Upload className={`w-10 h-10 mx-auto mb-3 ${
              isDragging ? 'text-primary' : selectedFile ? 'text-green-400' : 'text-dark-400'
            }`} />
            
            {selectedFile ? (
              <div>
                <p className="text-sm font-semibold text-green-400">{selectedFile.name}</p>
                <p className="text-xs text-dark-400 mt-1">
                  {(selectedFile.size / 1024).toFixed(2)} KB
                </p>
              </div>
            ) : (
              <div>
                <p className="text-sm font-semibold text-white">
                  {isDragging ? 'Drop your CSV file here' : 'Drag and drop your CSV file here'}
                </p>
                <p className="text-xs text-dark-400 mt-1">or</p>
                <label className="inline-block mt-2">
                  <span className="text-primary font-medium cursor-pointer hover:underline">
                    browse for a file
                  </span>
                  <input
                    type="file"
                    accept=".csv"
                    onChange={handleFileSelect}
                    className="hidden"
                  />
                </label>
              </div>
            )}
          </div>
        )}

        {/* Error Alert */}
        {error && (
          <div className="bg-red-900/20 border border-red-700/50 rounded-lg p-4 flex gap-3">
            <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-semibold text-red-400">Import Error</p>
              <p className="text-xs text-red-300/80 mt-1">{error}</p>
            </div>
          </div>
        )}

        {/* Import Result */}
        {result && (
          <div className="bg-green-900/20 border border-green-700/50 rounded-lg p-4">
            <div className="flex items-start gap-3">
              <CheckCircle className="w-5 h-5 text-green-400 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-semibold text-green-400">Import Successful!</p>
                <div className="mt-2 space-y-1 text-xs text-green-300/80">
                  <p>✓ Imported {result.importedCount} assets</p>
                  {result.errors && result.errors.length > 0 && (
                    <div className="mt-2 bg-yellow-900/20 rounded p-2">
                      <p className="font-semibold text-yellow-400 mb-1">Warnings ({result.errors.length}):</p>
                      {result.errors.slice(0, 5).map((err, idx) => (
                        <p key={idx} className="text-yellow-300/80">• {err}</p>
                      ))}
                      {result.errors.length > 5 && (
                        <p className="text-yellow-300/80 mt-1">... and {result.errors.length - 5} more</p>
                      )}
                    </div>
                  )}
                  <table className="mt-3 w-full text-xs">
                    <thead>
                      <tr className="border-b border-green-700/30">
                        <th className="text-left py-1">Symbol</th>
                        <th className="text-right py-1">Amount</th>
                        <th className="text-right py-1">Cost Basis</th>
                        <th className="text-right py-1">Current Value</th>
                      </tr>
                    </thead>
                    <tbody>
                      {result.assets.slice(0, 5).map((asset, idx) => (
                        <tr key={idx} className="border-b border-green-700/20">
                          <td className="py-1">{asset.symbol}</td>
                          <td className="text-right">{asset.amount}</td>
                          <td className="text-right">${asset.costBasis.toFixed(2)}</td>
                          <td className="text-right text-green-400">${asset.value.toFixed(2)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Actions */}
        <div className="flex gap-3 justify-end pt-4">
          <button
            onClick={handleClose}
            disabled={isLoading}
            className="px-4 py-2 bg-dark-700 hover:bg-dark-600 text-white rounded-lg font-medium disabled:opacity-50 transition-colors"
          >
            {result ? 'Close' : 'Cancel'}
          </button>
          {!result && (
            <button
              onClick={handleImport}
              disabled={!selectedFile || isLoading}
              className="px-4 py-2 bg-primary hover:bg-primary/90 text-white rounded-lg font-medium disabled:opacity-50 transition-colors flex items-center gap-2"
            >
              {isLoading ? (
                <>
                  <Loader className="w-4 h-4 animate-spin" />
                  Importing...
                </>
              ) : (
                <>
                  <Upload className="w-4 h-4" />
                  Import Assets
                </>
              )}
            </button>
          )}
        </div>
      </div>
    </Modal>
  );
};

export default CSVImportModal;
