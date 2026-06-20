import React, { useState, useEffect } from 'react';
import { AlertCircle, Loader } from 'lucide-react';
import Modal from '../../components/common/Modal';
import { addAssetToPortfolio, getAvailableAssets } from '../../services/portfolio.service';
import { getMarketPrices } from '../../services/market.service';

interface AddAssetModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAssetAdded: () => void;
}

interface AvailableAsset {
  id: string;
  name: string;
  symbol: string;
  type: 'crypto' | 'stock' | 'commodity' | 'forex';
  price: number;
}

const AddAssetModal: React.FC<AddAssetModalProps> = ({ isOpen, onClose, onAssetAdded }) => {
  const [selectedAsset, setSelectedAsset] = useState<AvailableAsset | null>(null);
  const [symbol, setSymbol] = useState<string>('');
  const [quantity, setQuantity] = useState<string>('');
  const [purchasePrice, setPurchasePrice] = useState<string>('');
  const [availableAssets, setAvailableAssets] = useState<AvailableAsset[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string>('');
  const [livePrice, setLivePrice] = useState<number | null>(null);
  const [priceFetching, setPriceFetching] = useState(false);

  // Helper function to safely extract numeric price from any format
  const extractPrice = (priceData: any): number => {
    // If already a number, validate it
    if (typeof priceData === 'number') {
      return isNaN(priceData) ? 0 : priceData;
    }
    
    // Handle objects - try multiple property names
    if (priceData && typeof priceData === 'object' && !Array.isArray(priceData)) {
      // Try common price property names
      const priceProps = ['price', 'value', 'currentPrice', 'p', 'c'];
      for (const prop of priceProps) {
        if (typeof priceData[prop] === 'number' && !isNaN(priceData[prop])) {
          return priceData[prop];
        }
      }
      
      // Try to convert object to string and parse
      try {
        const numVal = Number(priceData);
        if (!isNaN(numVal) && numVal !== 0) return numVal;
      } catch (e) {
        // Continue to next fallback
      }
    }
    
    // Handle string prices
    if (typeof priceData === 'string') {
      const parsed = parseFloat(priceData);
      return isNaN(parsed) ? 0 : parsed;
    }
    
    // Default fallback
    console.warn('Unable to extract price from:', priceData);
    return 0;
  };

  // Fetch live price when symbol changes
  useEffect(() => {
    if (!symbol || symbol.length < 2) { 
      setLivePrice(null); 
      return; 
    }
    const timer = setTimeout(async () => {
      setPriceFetching(true);
      try {
        const res = await getMarketPrices([symbol.toUpperCase()]);
        const priceData = res.data?.[symbol.toUpperCase()];
        if (priceData?.price) {
          setLivePrice(priceData.price);
          // Auto-fill the price field
          setPurchasePrice(String(priceData.price));
        }
      } catch (e) { /* silent */ }
      finally { setPriceFetching(false); }
    }, 600); // debounce 600ms

    return () => clearTimeout(timer);
  }, [symbol]);

  useEffect(() => {
    if (isOpen) {
      fetchAvailableAssets();
    }
  }, [isOpen]);

  const fetchAvailableAssets = async () => {
    try {
      setIsLoading(true);
      const response = await getAvailableAssets();
      if (process.env.NODE_ENV !== 'production') {
        console.log('DEBUG: getAvailableAssets response:', response);
      }
      
      if (response?.data) {
        // Double-ensure price is extracted as a number
        const normalizedAssets = response.data.map((asset: any) => {
          const normalizedPrice = extractPrice(asset.price);
          if (process.env.NODE_ENV !== 'production') {
            console.log(`DEBUG: Normalized ${asset.symbol} price:`, {
              originalPrice: asset.price,
              originalType: typeof asset.price,
              extractedPrice: normalizedPrice,
              extractedType: typeof normalizedPrice
            });
          }
          
          return {
            id: asset.id,
            name: asset.name,
            symbol: asset.symbol,
            type: asset.type || 'crypto',
            // Extract numeric price using helper function - ALWAYS a number
            price: normalizedPrice
          };
        });
        
        if (process.env.NODE_ENV !== 'production') {
          console.log('DEBUG: All normalized assets:', normalizedAssets);
        }
        setAvailableAssets(normalizedAssets);
      }
    } catch (err) {
      console.error('Error fetching available assets:', err);
      setError('Failed to load available assets');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    // Validation
    if (!selectedAsset) {
      setError('Please select an asset');
      return;
    }
    if (!quantity || parseFloat(quantity) <= 0) {
      setError('Please enter a valid quantity');
      return;
    }
    if (!purchasePrice || parseFloat(purchasePrice) <= 0) {
      setError('Please enter a valid purchase price');
      return;
    }

    try {
      setIsSubmitting(true);
      
      // Calculate required fields
      const qty = parseFloat(quantity);
      const costBasis = parseFloat(purchasePrice);
      
      // Extract price using the robust extractPrice helper
      let currentPrice = extractPrice(selectedAsset.price);
      if (process.env.NODE_ENV !== 'production') {
        console.log('✓ Extracted currentPrice:', currentPrice, 'Type:', typeof currentPrice);
      }
      
      // Validation: Price must be a valid number
      if (typeof currentPrice !== 'number' || isNaN(currentPrice) || currentPrice === 0) {
        if (process.env.NODE_ENV !== 'production') {
          console.warn('currentPrice invalid, aborting submit:', { currentPrice, type: typeof currentPrice, isNaN: isNaN(currentPrice) });
        }
        setError(`Invalid asset price detected: ${typeof currentPrice}. Please refresh and try again.`);
        setIsSubmitting(false);
        return;
      }
      
      const value = qty * currentPrice;
      const profit = (currentPrice - costBasis) * qty;
      const profitPercentage = ((currentPrice - costBasis) / costBasis) * 100;
      
      // Validate all calculations result in valid numbers
      if (isNaN(value) || isNaN(profit) || isNaN(profitPercentage)) {
        if (process.env.NODE_ENV !== 'production') {
          console.warn('Calculation resulted in NaN:', { value, profit, profitPercentage, currentPrice, qty, costBasis });
        }
        setError('Calculation error. Please check the values and try again.');
        setIsSubmitting(false);
        return;
      }
      
      // ULTRA-STRICT: Ensure all numeric values are actually numbers and never objects
      const sanitizeNumeric = (val: any, fieldName: string): number => {
        if (typeof val === 'object' && val !== null) {
          if (process.env.NODE_ENV !== 'production') {
            console.warn(`Field ${fieldName} is an object during sanitization:`, val);
          }
          throw new Error(`${fieldName} must be a number, not an object`);
        }
        const num = Number(val);
        if (isNaN(num)) {
          throw new Error(`${fieldName} is NaN: ${val}`);
        }
        return num;
      };
      
      const cleanedQty = sanitizeNumeric(qty, 'quantity');
      const cleanedCostBasis = sanitizeNumeric(costBasis, 'costBasis');
      const cleanedCurrentPrice = sanitizeNumeric(currentPrice, 'currentPrice');
      const cleanedValue = sanitizeNumeric(value, 'value');
      const cleanedProfit = sanitizeNumeric(profit, 'profit');
      const cleanedProfitPercentage = sanitizeNumeric(profitPercentage, 'profitPercentage');
      
      // ✅ NEW: Send only asset data to /api/portfolio/assets endpoint
      const assetPayload = {
        assetId: selectedAsset.id,
        symbol: selectedAsset.symbol,
        type: selectedAsset.type,
        amount: cleanedQty,
        costBasis: cleanedCostBasis,
        currentPrice: cleanedCurrentPrice,
        value: cleanedValue,
        profit: cleanedProfit,
        profitPercentage: cleanedProfitPercentage,
        allocation: 100 // 100% allocation for single asset
      };
      
      console.log('DEBUG: Submitting asset to new endpoint:', assetPayload);
      
      if (process.env.NODE_ENV !== 'production') {
        console.log('DEBUG: Submitting asset to new endpoint:', assetPayload);
      }
      
      const response = await addAssetToPortfolio(assetPayload);

      if (response?.status === 'success') {
        // Reset form
        setSelectedAsset(null);
        setQuantity('');
        setPurchasePrice('');
        
        // Notify parent and close
        onAssetAdded();
        onClose();
      } else {
        setError(response?.message || 'Failed to add asset');
      }
    } catch (err: any) {
      console.error('Error adding asset:', err);
      setError(err?.message || 'Failed to add asset. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Helper function to deeply clean payload - ensure NO objects in numeric fields
  const deepCleanPayload = (payload: any): any => {
    // Helper to extract numeric price from any structure
    const extractNumericPrice = (priceValue: any, fieldName: string = 'price'): number => {
      // If it's already a number, return it
      if (typeof priceValue === 'number') {
        if (!isNaN(priceValue)) return priceValue;
      }
      
      // If it's an object, try to extract price property
      if (priceValue && typeof priceValue === 'object') {
        if (process.env.NODE_ENV !== 'production') {
          console.warn(`⚠️ ${fieldName} is an object, attempting extraction:`, priceValue);
        }
        if (typeof priceValue.price === 'number' && !isNaN(priceValue.price)) {
          return priceValue.price;
        }
        if (typeof priceValue.value === 'number' && !isNaN(priceValue.value)) {
          return priceValue.value;
        }
      }
      
      // Try string conversion
      if (typeof priceValue === 'string') {
        const parsed = parseFloat(priceValue);
        if (!isNaN(parsed)) return parsed;
      }
      
      // Last resort: try Number() conversion
      const numValue = Number(priceValue);
      if (!isNaN(numValue)) return numValue;
      
      // If all else fails, return 0
      if (process.env.NODE_ENV !== 'production') {
        console.warn(`Could not extract numeric value for ${fieldName}:`, priceValue);
      }
      return 0;
    };
    
    return {
      name: String(payload.name),
      description: String(payload.description),
      assets: (payload.assets || []).map((asset: any) => {
        const cleanAsset = {
          assetId: String(asset.assetId),
          symbol: String(asset.symbol),
          type: String(asset.type),
          amount: extractNumericPrice(asset.amount, 'amount'),
          costBasis: extractNumericPrice(asset.costBasis, 'costBasis'),
          currentPrice: extractNumericPrice(asset.currentPrice, 'currentPrice'),
          value: extractNumericPrice(asset.value, 'value'),
          profit: extractNumericPrice(asset.profit, 'profit'),
          profitPercentage: extractNumericPrice(asset.profitPercentage, 'profitPercentage'),
          allocation: extractNumericPrice(asset.allocation, 'allocation')
        };

        // Final validation - ensure ALL numeric fields are actually numbers
        Object.entries(cleanAsset).forEach(([key, val]) => {
          if (typeof val !== 'string') {
            if (typeof val !== 'number') {
              if (process.env.NODE_ENV !== 'production') {
                console.warn(`Field ${key} is not a number after cleaning:`, { key, val, type: typeof val });
              }
              throw new Error(`Field ${key} must be a number, got ${typeof val}`);
            }
            if (isNaN(val as number)) {
              if (process.env.NODE_ENV !== 'production') {
                console.warn(`Field ${key} is NaN:`, { key, val });
              }
              throw new Error(`Field ${key} is NaN`);
            }
          }
        });

        return cleanAsset;
      }),
      totalValue: extractNumericPrice(payload.totalValue, 'totalValue'),
      totalProfit: extractNumericPrice(payload.totalProfit, 'totalProfit'),
      totalProfitPercentage: extractNumericPrice(payload.totalProfitPercentage, 'totalProfitPercentage')
    };
  };

  const calculateTotal = () => {
    const qty = parseFloat(quantity) || 0;
    const price = parseFloat(purchasePrice) || 0;
    return qty * price;
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Add Asset to Portfolio" size="lg">
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <div className="flex items-center gap-3 p-3 bg-red-500/10 border border-red-500/50 rounded-lg">
            <AlertCircle size={20} className="text-red-500" />
            <p className="text-red-500 text-sm">{error}</p>
          </div>
        )}

        {/* Select Asset */}
        <div>
          <label className="block text-sm font-medium text-light mb-2">Select Asset</label>
          {isLoading ? (
            <div className="flex items-center justify-center p-4 bg-dark-700 rounded-lg">
              <Loader size={20} className="animate-spin text-primary" />
              <span className="ml-2 text-dark-400">Loading assets...</span>
            </div>
          ) : (
            <select
              value={selectedAsset?.id || ''}
              onChange={(e) => {
                const asset = availableAssets.find(a => a.id === e.target.value);
                setSelectedAsset(asset || null);
                // Set symbol for live price fetching
                if (asset) {
                  setSymbol(asset.symbol);
                  // Auto-populate purchase price with today's market price
                  if (asset.price > 0) {
                    setPurchasePrice(asset.price.toFixed(2));
                  }
                } else {
                  setSymbol('');
                }
              }}
              className="w-full px-4 py-2 bg-dark-700 border border-dark-600 rounded-lg text-light focus:outline-none focus:border-primary"
            >
              <option value="">-- Select an asset --</option>
              {availableAssets.map(asset => (
                <option key={asset.id} value={asset.id}>
                  {asset.symbol} - {asset.name} (${asset.price})
                </option>
              ))}
            </select>
          )}
        </div>

        {/* Asset Details */}
        {selectedAsset && (
          <div className="p-3 bg-dark-700 rounded-lg">
            <div className="grid grid-cols-2 gap-2 text-sm">
              <div>
                <p className="text-dark-400">Current Price</p>
                <p className="text-light font-medium">${selectedAsset.price.toFixed(2)}</p>
              </div>
              <div>
                <p className="text-dark-400">Type</p>
                <p className="text-light font-medium capitalize">{selectedAsset.type}</p>
              </div>
            </div>
          </div>
        )}

        {/* Quantity */}
        <div>
          <label className="block text-sm font-medium text-light mb-2">Quantity</label>
          <input
            type="number"
            step="0.00000001"
            placeholder="Enter quantity"
            value={quantity}
            onChange={(e) => setQuantity(e.target.value)}
            className="w-full px-4 py-2 bg-dark-700 border border-dark-600 rounded-lg text-light placeholder-dark-500 focus:outline-none focus:border-primary"
          />
        </div>

        {/* Purchase Price */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="block text-sm font-medium text-light">Purchase Price (USD)</label>
            {priceFetching && <span className="text-xs text-dark-400">Fetching live price...</span>}
            {livePrice && <span className="text-xs text-green-400">Live: ${livePrice.toLocaleString()}</span>}
          </div>
          <input
            type="number"
            step="0.01"
            placeholder="Enter purchase price"
            value={purchasePrice}
            onChange={(e) => setPurchasePrice(e.target.value)}
            className="w-full px-4 py-2 bg-dark-700 border border-dark-600 rounded-lg text-light placeholder-dark-500 focus:outline-none focus:border-primary"
          />
        </div>

        {/* Total */}
        {quantity && purchasePrice && (
          <div className="p-3 bg-primary/10 border border-primary/30 rounded-lg">
            <p className="text-dark-400 text-sm">Total Investment</p>
            <p className="text-xl font-bold text-primary">
              ${calculateTotal().toFixed(2)}
            </p>
          </div>
        )}

        {/* Buttons */}
        <div className="flex gap-2 pt-4">
          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            className="flex-1 px-4 py-2 bg-dark-700 text-light rounded-lg hover:bg-dark-600 transition-colors disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={isSubmitting || !selectedAsset || !quantity || !purchasePrice}
            className="flex-1 px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary-600 transition-colors disabled:opacity-50 flex items-center justify-center"
          >
            {isSubmitting ? (
              <>
                <Loader size={16} className="animate-spin mr-2" />
                Adding...
              </>
            ) : (
              'Add Asset'
            )}
          </button>
        </div>
      </form>
    </Modal>
  );
};

export default AddAssetModal;
