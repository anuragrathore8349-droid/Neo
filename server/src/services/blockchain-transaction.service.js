const ethers = require('ethers');
const config = require('../config');
const { logger } = require('../api/middlewares/logger.middleware');

class BlockchainTransactionService {
  constructor() {
    this.etherscanApiKey = config.apis.etherscan;
    this.chainId = config.blockchain.ethereum.chainId;
  }

  /**
   * Get the correct Etherscan API URL based on network
   * @private
   */
  getEtherscanBaseUrl(network = null) {
    const chainId = this.getChainIdForApi(network);
    
    // Use network-specific Etherscan endpoints
    const endpoints = {
      1: 'https://api.etherscan.io/api',           // Ethereum mainnet
      5: 'https://goerli.api.etherscan.io/api',    // Goerli testnet
      11155111: 'https://sepolia.api.etherscan.io/api', // Sepolia testnet
      137: 'https://api.polygonscan.com/api',      // Polygon
      56: 'https://api.bscscan.com/api',           // BSC
      42161: 'https://api.arbiscan.io/api',        // Arbitrum
      10: 'https://api-optimistic.etherscan.io/api', // Optimism
      8453: 'https://api.basescan.org/api'         // Base
    };
    
    return endpoints[chainId] || 'https://api.etherscan.io/api';
  }

  /**
   * Get the chain ID for API queries
   * @private
   */
  getChainIdForApi(network = null) {
    let chainId = this.chainId;
    
    if (network) {
      if (typeof network === 'string') {
        const networkToChainId = {
          '1': 1,
          '11155111': 11155111,
          '5': 5,
          '137': 137,
          '56': 56,
          'mainnet': 1,
          'ethereum': 1,
          'sepolia': 11155111,
          'goerli': 5,
          'polygon': 137,
          'bsc': 56
        };
        
        chainId = networkToChainId[network.toLowerCase()] || parseInt(network) || this.chainId;
      } else {
        chainId = network;
      }
    }

    return chainId;
  }

  /**
   * Fetch real blockchain transactions for a wallet address from Etherscan
   * @param {string} address - Wallet address
   * @param {number} limit - Number of transactions to fetch (default 100)
   * @param {string} network - Network identifier (optional, falls back to config)
   * @returns {Promise<Array>} Array of transactions
   */
  async fetchBlockchainTransactions(address, limit = 100, network = null) {
    try {
      if (!ethers.isAddress(address)) {
        throw new Error('Invalid Ethereum address');
      }

      logger.debug('Fetching transactions', { address, network });

      if (!this.etherscanApiKey || this.etherscanApiKey === 'YourEtherscanApiKeyHere') {
        logger.warn('Etherscan API key not configured, returning mock transactions for testing');
        
        // ✅ Fix: Declare normalizedAddress before using it
        const normalizedAddress = ethers.utils.getAddress(address);
        
        logger.debug('Returning mock transactions for testing');
        // Return mock transactions for testing
        return [
          {
            id: 'mock_tx_1',
            hash: '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef',
            from: '0x742d35Cc6634C0532925a3b844Bc454e4438f44e',
            to: normalizedAddress,
            value: '0.5',
            asset: 'ETH',
            gasUsed: '21000',
            gasPrice: '20000000000',
            status: 'completed',
            timestamp: new Date(Date.now() - 86400000).toISOString(), // 1 day ago
            type: 'receive',
            network: this.getNetworkName(),
            blockNumber: '18500000',
            sourceAddress: '0x742d35Cc6634C0532925a3b844Bc454e4438f44e',
            destinationAddress: normalizedAddress
          },
          {
            id: 'mock_tx_2',
            hash: '0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890',
            from: normalizedAddress,
            to: '0x742d35Cc6634C0532925a3b844Bc454e4438f44e',
            value: '0.1',
            asset: 'ETH',
            gasUsed: '21000',
            gasPrice: '25000000000',
            status: 'completed',
            timestamp: new Date(Date.now() - 172800000).toISOString(), // 2 days ago
            type: 'send',
            network: this.getNetworkName(),
            blockNumber: '18490000',
            sourceAddress: normalizedAddress,
            destinationAddress: '0x742d35Cc6634C0532925a3b844Bc454e4438f44e'
          }
        ].slice(0, limit);
      }

      logger.debug('Calling Etherscan API');
      const normalizedAddress = ethers.utils.getAddress(address);
      
      logger.debug('Preparing Etherscan API call', { chainId: this.getChainIdForApi(network), network });
      
      const txUrl = new URL(this.getEtherscanBaseUrl(network));
      txUrl.searchParams.append('module', 'account');
      txUrl.searchParams.append('action', 'txlist');
      txUrl.searchParams.append('address', normalizedAddress);
      txUrl.searchParams.append('startblock', '0');
      txUrl.searchParams.append('endblock', '99999999');
      txUrl.searchParams.append('sort', 'desc');
      txUrl.searchParams.append('apikey', this.etherscanApiKey);

      logger.debug('Etherscan API URL prepared');
      const response = await fetch(txUrl.toString());
      
      if (!response.ok) {
        logger.error('Etherscan API error:', response.statusText, response.status);
        return [];
      }

      const data = await response.json();
      logger.debug('Etherscan response received', { status: data.status, count: data.result?.length || 0 });

      if (data.status !== '1' || !Array.isArray(data.result)) {
        logger.warn('Etherscan API error or no transactions found', { status: data.status, message: data.message, address: normalizedAddress });
        return [];
      }

      // Transform Etherscan transactions to our format
      const transactions = data.result.slice(0, limit).map(tx => ({
        id: tx.hash,
        hash: tx.hash,
        from: tx.from,
        to: tx.to || null,
        value: ethers.formatEther(tx.value),
        asset: 'ETH',
        gasUsed: tx.gas,
        gasPrice: ethers.utils.formatUnits(tx.gasPrice, 'gwei'),
        status: tx.isError === '0' ? 'completed' : 'failed',
        timestamp: new Date(parseInt(tx.timeStamp) * 1000).toISOString(),
        type: this.determineTransactionType(tx.from, normalizedAddress, tx.to),
        network: this.getNetworkName(),
        blockNumber: tx.blockNumber,
        sourceAddress: tx.from,
        destinationAddress: tx.to || null
      }));

      logger.info(`Fetched ${transactions.length} blockchain transactions for ${normalizedAddress}`);
      return transactions;
    } catch (error) {
      logger.error('Error fetching blockchain transactions:', error);
      return [];
    }
  }

  /**
   * Determine transaction type (send/receive)
   * @private
   */
  determineTransactionType(fromAddress, walletAddress, toAddress) {
    const normalizedWallet = ethers.utils.getAddress(walletAddress);
    const normalizedFrom = ethers.utils.getAddress(fromAddress);
    const normalizedTo = toAddress ? ethers.utils.getAddress(toAddress) : null;

    if (normalizedFrom === normalizedWallet) {
      return 'send';
    } else if (normalizedTo === normalizedWallet) {
      return 'receive';
    } else {
      return 'transfer';
    }
  }

  /**
   * Get network name based on chain ID or network string
   * @private
   */
  getNetworkName(network = null) {
    let chainId = this.chainId;
    
    if (network) {
      if (typeof network === 'string') {
        const networkToChainId = {
          '1': 1,
          '11155111': 11155111,
          '5': 5,
          '137': 137,
          '56': 56,
          'mainnet': 1,
          'ethereum': 1,
          'sepolia': 11155111,
          'goerli': 5,
          'polygon': 137,
          'bsc': 56
        };
        
        chainId = networkToChainId[network.toLowerCase()] || parseInt(network) || this.chainId;
      } else {
        chainId = network;
      }
    }

    switch (chainId) {
      case 1:
        return 'Ethereum Mainnet';
      case 5:
        return 'Goerli Testnet';
      case 11155111:
        return 'Sepolia Testnet';
      case 137:
        return 'Polygon';
      case 56:
        return 'BSC';
      default:
        return `Chain ${chainId}`;
    }
  }

  /**
   * Fetch and merge blockchain transactions with stored transactions
   * Removes duplicates and sorts by timestamp
   */
  async getFullTransactionHistory(address, storedTransactions = [], network = null) {
    try {
      // Fetch real blockchain transactions
      const blockchainTxs = await this.fetchBlockchainTransactions(address, 100, network);

      // Create a Set of blockchain tx hashes for deduplication
      const blockchainHashes = new Set(blockchainTxs.map(tx => tx.hash.toLowerCase()));

      // Filter stored transactions to avoid duplicates
      const uniqueStoredTxs = storedTransactions.filter(
        tx => !blockchainHashes.has(tx.txHash?.toLowerCase())
      );

      // Merge and sort by timestamp (newest first)
      const allTransactions = [
        ...blockchainTxs,
        ...uniqueStoredTxs.map(tx => ({
          id: tx._id?.toString() || tx.txHash,
          hash: tx.txHash,
          from: tx.sourceAddress,
          to: tx.destinationAddress,
          value: tx.amount,
          asset: tx.asset,
          gasUsed: tx.gasUsed || null,
          gasPrice: tx.gasPrice || null,
          status: tx.status || 'pending',
          timestamp: tx.timestamp?.toISOString() || new Date().toISOString(),
          type: tx.type === 'deposit' ? 'receive' : tx.type === 'withdrawal' ? 'send' : 'transfer',
          network: tx.network,
          blockNumber: null,
          sourceAddress: tx.sourceAddress,
          destinationAddress: tx.destinationAddress,
          isFromDatabase: true
        }))
      ];

      // Sort by timestamp (newest first)
      allTransactions.sort((a, b) => {
        const timeA = new Date(a.timestamp).getTime();
        const timeB = new Date(b.timestamp).getTime();
        return timeB - timeA;
      });

      return allTransactions;
    } catch (error) {
      logger.error('Error merging transactions:', error);
      throw error;
    }
  }
}

module.exports = new BlockchainTransactionService();
