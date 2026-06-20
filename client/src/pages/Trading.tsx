// This file is intentionally a redirect to the new Trading module.
// The full Trading implementation is in ./Trading/index.tsx
export { default } from './Trading/index';

  useEffect(() => {
    if (assets.length > 0 && !selectedAsset) {
      setSelectedAsset(assets[0]);
    }
  }, [assets, selectedAsset]);

  useEffect(() => {
    if (selectedAsset) {
      loadTradingData(selectedAsset.symbol);
      loadOpenOrders(selectedAsset.symbol);
    }
  }, [selectedAsset]);

  const loadTradingData = async (symbol: string) => {
    setIsMarketLoading(true);
    setOrderError(null);

    try {
      const [bookResponse, tradeResponse, historyResponse] = await Promise.all([
        tradingApi.getOrderBook(symbol),
        tradingApi.getRecentTrades(symbol),
        tradingApi.getOrderHistory(symbol)
      ]);

      setOrderBookData(bookResponse.data || { asks: [], bids: [] });
      setRecentTrades(tradeResponse.data || []);
      setOrderHistory(historyResponse.data || []);
    } catch (error: any) {
      setOrderError(error?.message || 'Unable to load trading data.');
    } finally {
      setIsMarketLoading(false);
    }
  };

  const loadOpenOrders = async (symbol?: string) => {
    try {
      const response = await tradingApi.getOpenOrders(symbol);
      setOpenOrders(response.data || []);
    } catch (error: any) {
      console.error('Failed to load open orders:', error?.message || error);
    }
  };

  const handleCancelOrder = async (orderId: string) => {
    setIsCancellingOrder(orderId);
    try {
      await tradingApi.cancelOrder(orderId);
      setOpenOrders(openOrders.filter(order => order.id !== orderId));
      setOrderError(null);
    } catch (error: any) {
      setOrderError(error?.message || 'Failed to cancel order.');
    } finally {
      setIsCancellingOrder(null);
    }
  };

  const handlePlaceOrder = async (order: any) => {
    if (!selectedAsset) return;

    setOrderError(null);
    setIsOrdersLoading(true);

    try {
      const response = await tradingApi.placeOrder({
        symbol: selectedAsset.symbol,
        exchange: 'binance',
        type: order.type,
        side: order.side,
        amount: order.amount,
        price: order.price,
        stopPrice: order.stopPrice,
        timeInForce: order.timeInForce || 'GTC',
        postOnly: order.postOnly || false,
        reduceOnly: order.reduceOnly || false
      });

      const orderData = response.data;
      setOrderHistory(prev => [orderData, ...prev]);
      await loadTradingData(selectedAsset.symbol);
    } catch (error: any) {
      setOrderError(error?.message || 'Failed to place order.');
    } finally {
      setIsOrdersLoading(false);
    }
  };

  const filteredAssets = assets.filter(asset => {
    const matchesSearch = searchTerm === '' || 
      asset.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
      asset.symbol.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesType = assetTypeFilter === null || asset.type === assetTypeFilter;
    
    return matchesSearch && matchesType;
  });

  const toggleWatchlist = (assetId: string) => {
    if (watchlist.includes(assetId)) {
      setWatchlist(watchlist.filter(id => id !== assetId));
    } else {
      setWatchlist([...watchlist, assetId]);
    }
  };

  const generateChartData = () => {
    const data = [];
    const days = 30;
    let price = selectedAsset?.price || 45000;
    const volatility = 0.02;

    for (let i = days; i >= 0; i--) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      const change = (Math.random() - 0.5) * 2 * volatility * price;
      const open = price;
      const close = price + change;
      const high = Math.max(open, close) + Math.random() * (price * 0.01);
      const low = Math.min(open, close) - Math.random() * (price * 0.01);
      const volume = Math.random() * 5000 + 1000;

      data.push({
        date: date.toISOString().split('T')[0],
        open,
        close,
        high,
        low,
        volume
      });

      price = close;
    }

    return data;
  };

  const chartData = generateChartData();

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold">Trading</h2>
        <div className="flex space-x-2">
          <button className="btn-outline">Order History</button>
          <button className="btn-primary">Deposit</button>
        </div>
      </div>
      
      <Tabs defaultValue="market" className="mb-6">
        <TabsList>
          <TabsTrigger value="market" onClick={() => setActiveTab('market')}>Market</TabsTrigger>
          <TabsTrigger value="trade" onClick={() => setActiveTab('trade')}>Trade</TabsTrigger>
          <TabsTrigger value="watchlist" onClick={() => setActiveTab('watchlist')}>Watchlist</TabsTrigger>
          <TabsTrigger value="open-orders" onClick={() => { setActiveTab('open-orders'); loadOpenOrders(); }}>Open Orders</TabsTrigger>
          <TabsTrigger value="orders" onClick={() => setActiveTab('orders')}>Order History</TabsTrigger>
        </TabsList>
        
        <TabsContent value="market" className="pt-6">
          <MarketOverview assets={assets} />
        </TabsContent>
        
        <TabsContent value="trade" className="pt-6">
          <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
            <div className="lg:col-span-1">
              <GlassCard className="p-6">
                <div className="flex justify-between items-center mb-4">
                  <h3 className="text-lg font-semibold">Assets</h3>
                  <div className="flex space-x-2">
                    <button className="p-2 rounded-lg bg-dark-800 text-dark-400 hover:text-light">
                      <Filter size={16} />
                    </button>
                    <button className="p-2 rounded-lg bg-dark-800 text-dark-400 hover:text-light">
                      <ArrowUpDown size={16} />
                    </button>
                  </div>
                </div>
                
                <div className="relative mb-4">
                  <Search size={16} className="absolute left-3 top-1/2 transform -translate-y-1/2 text-dark-400" />
                  <input
                    type="text"
                    placeholder="Search assets..."
                    className="input-field pl-10 w-full"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                  />
                </div>
                
                <div className="flex space-x-2 mb-4 overflow-x-auto pb-2">
                  <button
                    className={`px-3 py-1 text-xs rounded-lg transition-all whitespace-nowrap ${
                      assetTypeFilter === null ? 'bg-primary text-white' : 'bg-dark-800 text-dark-400 hover:text-light'
                    }`}
                    onClick={() => setAssetTypeFilter(null)}
                  >
                    All
                  </button>
                  <button
                    className={`px-3 py-1 text-xs rounded-lg transition-all whitespace-nowrap ${
                      assetTypeFilter === 'crypto' ? 'bg-primary text-white' : 'bg-dark-800 text-dark-400 hover:text-light'
                    }`}
                    onClick={() => setAssetTypeFilter('crypto')}
                  >
                    Crypto
                  </button>
                  <button
                    className={`px-3 py-1 text-xs rounded-lg transition-all whitespace-nowrap ${
                      assetTypeFilter === 'stock' ? 'bg-primary text-white' : 'bg-dark-800 text-dark-400 hover:text-light'
                    }`}
                    onClick={() => setAssetTypeFilter('stock')}
                  >
                    Stocks
                  </button>
                  <button
                    className={`px-3 py-1 text-xs rounded-lg transition-all whitespace-nowrap ${
                      assetTypeFilter === 'forex' ? 'bg-primary text-white' : 'bg-dark-800 text-dark-400 hover:text-light'
                    }`}
                    onClick={() => setAssetTypeFilter('forex')}
                  >
                    Forex
                  </button>
                </div>
                
                <div className="max-h-[500px] overflow-y-auto pr-2">
                  {filteredAssets.map((asset) => (
                    <div 
                      key={asset.id}
                      className={`flex justify-between items-center p-3 rounded-lg mb-2 cursor-pointer transition-all ${
                        selectedAsset?.id === asset.id ? 'bg-primary/10 border border-primary/30' : 'hover:bg-dark-800/70'
                      }`}
                      onClick={() => setSelectedAsset(asset)}
                    >
                      <div className="flex items-center">
                        <div className="h-8 w-8 rounded-full bg-dark-700 flex items-center justify-center mr-3">
                          <span className="text-xs font-medium">{asset.symbol.substring(0, 2)}</span>
                        </div>
                        <div>
                          <div className="flex items-center">
                            <p className="font-medium">{asset.symbol}</p>
                            <button 
                              className="ml-2 text-dark-400 hover:text-amber-400"
                              onClick={(e) => {
                                e.stopPropagation();
                                toggleWatchlist(asset.id);
                              }}
                            >
                              <Star 
                                size={14} 
                                className={watchlist.includes(asset.id) ? 'text-amber-400 fill-amber-400' : ''} 
                              />
                            </button>
                          </div>
                          <p className="text-dark-400 text-xs">{asset.name}</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="font-medium">{formatCurrency(asset.price)}</p>
                        <p className={`text-xs ${asset.change24h >= 0 ? 'text-secondary' : 'text-red-500'}`}>
                          {formatPercentage(asset.change24h)}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </GlassCard>
            </div>
            
            <div className="lg:col-span-3">
              {selectedAsset ? (
                <div className="grid grid-cols-1 gap-6">
                  <MarketChart asset={selectedAsset} data={chartData} />
                  <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    <div className="lg:col-span-2">
                      <OrderBook
                        asks={orderBookData.asks}
                        bids={orderBookData.bids}
                        currentPrice={selectedAsset.price}
                        loading={isMarketLoading}
                      />
                    </div>
                    <div className="lg:col-span-1">
                      <TradeForm
                        asset={selectedAsset}
                        onPlaceOrder={handlePlaceOrder}
                        loading={isOrdersLoading}
                      />
                      {orderError && (
                        <div className="mt-4 p-3 rounded-lg bg-red-500/10 text-red-300 border border-red-500">
                          {orderError}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ) : (
                <GlassCard className="p-6 h-full flex items-center justify-center">
                  <div className="text-center">
                    <p className="text-xl font-medium mb-2">Select an asset to trade</p>
                    <p className="text-dark-400">Choose from the list on the left to view charts and place orders</p>
                  </div>
                </GlassCard>
              )}
            </div>
          </div>
        </TabsContent>
        
        <TabsContent value="watchlist" className="pt-6">
          <Watchlist
            assets={assets}
            watchlist={watchlist}
            onToggleWatchlist={toggleWatchlist}
            onSelectAsset={(asset) => {
              setSelectedAsset(asset);
              setActiveTab('trade');
            }}
          />
        </TabsContent>
        
        <TabsContent value="open-orders" className="pt-6">
          <GlassCard className="p-6">
            <h3 className="text-lg font-semibold mb-4">Active Orders</h3>
            {openOrders.length === 0 ? (
              <div className="text-center py-8">
                <p className="text-dark-400">No active orders</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-dark-700">
                      <th className="text-left p-3 text-sm font-semibold">Symbol</th>
                      <th className="text-left p-3 text-sm font-semibold">Type</th>
                      <th className="text-left p-3 text-sm font-semibold">Side</th>
                      <th className="text-right p-3 text-sm font-semibold">Amount</th>
                      <th className="text-right p-3 text-sm font-semibold">Price</th>
                      <th className="text-right p-3 text-sm font-semibold">Status</th>
                      <th className="text-center p-3 text-sm font-semibold">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {openOrders.map((order) => (
                      <tr key={order.id} className="border-b border-dark-800 hover:bg-dark-800/50">
                        <td className="p-3">{order.symbol}</td>
                        <td className="p-3 text-sm capitalize">{order.type}</td>
                        <td className={`p-3 text-sm font-medium ${order.side === 'buy' ? 'text-secondary' : 'text-red-500'}`}>
                          {order.side.toUpperCase()}
                        </td>
                        <td className="p-3 text-right text-sm">{order.amount}</td>
                        <td className="p-3 text-right text-sm">{formatCurrency(order.price || 0)}</td>
                        <td className="p-3 text-right text-sm">
                          <span className={`px-2 py-1 rounded text-xs font-medium ${
                            order.status === 'open' ? 'bg-primary/20 text-primary' : 'bg-yellow-500/20 text-yellow-400'
                          }`}>
                            {order.status || 'Pending'}
                          </span>
                        </td>
                        <td className="p-3 text-center">
                          <button
                            onClick={() => handleCancelOrder(order.id)}
                            disabled={isCancellingOrder === order.id}
                            className="p-2 rounded-lg bg-red-500/10 text-red-500 hover:bg-red-500/20 disabled:opacity-50"
                            title="Cancel Order"
                          >
                            {isCancellingOrder === order.id ? (
                              <span className="text-xs">Cancelling...</span>
                            ) : (
                              <Trash2 size={16} />
                            )}
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </GlassCard>
        </TabsContent>
        
        <TabsContent value="orders" className="pt-6">
          <OrderHistory orders={orderHistory} />
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default Trading;