const ethers = require('ethers');
const Wallet = require('../models/wallet.model');
const Transaction = require('../models/transaction.model');
const BinanceIntegration = require('../integrations/exchanges/binance');
const { logger } = require('../api/middlewares/logger.middleware');
const { ethereumProvider } = require('../config/blockchain');
const { getLiveGasPrices } = require('../utils/blockchain');
const blockchainTransactionService = require('./blockchain-transaction.service');

// ERC-20 balanceOf ABI fragment
const ERC20_ABI = [
  'function balanceOf(address owner) view returns (uint256)',
  'function decimals() view returns (uint8)',
  'function symbol() view returns (string)',
];

// Common ERC-20 tokens on Ethereum mainnet
const KNOWN_TOKENS = [
  { symbol: 'USDC',  address: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48', decimals: 6 },
  { symbol: 'USDT',  address: '0xdAC17F958D2ee523a2206206994597C13D831ec7', decimals: 6 },
  { symbol: 'DAI',   address: '0x6B175474E89094C44Da98b954EedeAC495271d0F', decimals: 18 },
  { symbol: 'WBTC',  address: '0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599', decimals: 8 },
  { symbol: 'LINK',  address: '0x514910771AF9Ca656af840dff83E8264EcF986CA', decimals: 18 },
];

class WalletService {
  constructor() {
    // Initialize exchange integrations
    this.exchanges = {
      binance: new BinanceIntegration(
        process.env.BINANCE_API_KEY,
        process.env.BINANCE_API_SECRET
      )
    };
  }

  async getWallets(userId) {
    try {
      const wallets = await Wallet.find({ userId });
      
      // Update balances for all wallets
      const updatedWallets = await Promise.all(
        wallets.map(wallet => this.updateWalletBalances(wallet))
      );

      return updatedWallets;
    } catch (error) {
      logger.error('Error fetching wallets:', error);
      throw error;
    }
  }

  async connectWallet(userId, walletData) {
    try {
      // ✅ ALWAYS verify wallet ownership using signature
      logger.info(`Connecting wallet for user: ${userId}`);
      logger.debug(`Wallet data: address=${walletData.address}, type=${walletData.type}`);
      
      if (!walletData.signature) {
        throw new Error('Signature is required to verify wallet ownership');
      }

      await this.verifyWalletOwnership(walletData.address, walletData.signature);

      // Check if wallet already exists
      const existingWallet = await Wallet.findOne({
        userId,
        address: walletData.address
      });

      if (existingWallet) {
        throw new Error('Wallet already connected');
      }

      // ✅ Normalize network field from hex chain ID to readable name
      const normalizedWalletData = {
        ...walletData,
        network: this.normalizeNetwork(walletData.network)
      };

      // Create new wallet
      const wallet = new Wallet({
        userId,
        ...normalizedWalletData,
        isVerified: true  // ✅ Mark as verified since we verified the signature
      });

      // Get initial balances
      await this.updateWalletBalances(wallet);

      logger.info(`Wallet connected: ${wallet.address} on ${wallet.network}`);
      return wallet.save();
    } catch (error) {
      logger.error(`Connect wallet error: ${error.message}`);
      throw error;
    }
  }

  async removeWallet(userId, walletId) {
    try {
      const result = await Wallet.deleteOne({
        _id: walletId,
        userId
      });

      if (result.deletedCount === 0) {
        throw new Error('Wallet not found');
      }
    } catch (error) {
      logger.error('Error removing wallet:', error);
      throw error;
    }
  }

  async getTransactions(userId, filters) {
    try {
      // ✅ Add default values to prevent NaN pagination
      filters.page = filters.page || 1;
      filters.limit = filters.limit || 50;
      filters.type = filters.type || 'all';

      // If no walletId specified, fetch all user's external wallet transactions from blockchain
      // Otherwise, check if wallet is external and fetch blockchain data
      
      let transactions = [];

      if (filters.walletId) {
        // Fetch specific wallet transactions
        const wallet = await Wallet.findOne({
          _id: filters.walletId,
          userId
        });

        if (!wallet) {
          throw new Error('Wallet not found');
        }

        if (wallet.type === 'external') {
          // For external wallets, fetch real blockchain data
          const storedTxs = await Transaction.find({
            walletId: wallet._id,
            userId
          });
          
          const allTransactions = await blockchainTransactionService.getFullTransactionHistory(
            wallet.address,
            storedTxs,
            wallet.network // Pass the wallet's network
          );
          
          transactions = allTransactions;
        } else {
          // For exchange/defi wallets, use stored transactions
          const query = { userId, walletId: wallet._id };
          
          if (filters.type !== 'all') {
            query.type = filters.type;
          }

          if (filters.from || filters.to) {
            query.timestamp = {};
            if (filters.from) query.timestamp.$gte = new Date(filters.from);
            if (filters.to) query.timestamp.$lte = new Date(filters.to);
          }

          transactions = await Transaction.find(query)
            .sort({ timestamp: -1 });
        }
      } else {
        // Fetch all external wallet transactions for the user (from blockchain)
        const externalWallets = await Wallet.find({
          userId,
          type: 'external'
        });

        let allTransactions = [];

        // Fetch blockchain transactions for each external wallet
        for (const wallet of externalWallets) {
          const storedTxs = await Transaction.find({
            walletId: wallet._id,
            userId
          });

          const walletTransactions = await blockchainTransactionService.getFullTransactionHistory(
            wallet.address,
            storedTxs,
            wallet.network // Pass the wallet's network
          );
          
          allTransactions = allTransactions.concat(walletTransactions);
        }

        // Also get stored exchange/defi transactions
        const storedTxs = await Transaction.find({
          userId,
          walletId: { $in: await Wallet.find({ userId, type: { $ne: 'external' } }).distinct('_id') }
        });

        allTransactions = allTransactions.concat(
          storedTxs.map(tx => ({
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
        );

        // Sort by timestamp (newest first) and apply filters
        allTransactions.sort((a, b) => {
          const timeA = new Date(a.timestamp).getTime();
          const timeB = new Date(b.timestamp).getTime();
          return timeB - timeA;
        });

        // Apply type filter
        if (filters.type !== 'all') {
          allTransactions = allTransactions.filter(tx => tx.type === filters.type);
        }

        // Apply date filters
        if (filters.from || filters.to) {
          allTransactions = allTransactions.filter(tx => {
            const txDate = new Date(tx.timestamp);
            const fromMatch = filters.from ? txDate >= new Date(filters.from) : true;
            const toMatch = filters.to ? txDate <= new Date(`${filters.to}T23:59:59.999Z`) : true;
            return fromMatch && toMatch;
          });
        }

        transactions = allTransactions;
      }

      // Apply pagination to the final results
      const startIndex = (filters.page - 1) * filters.limit;
      const paginatedTransactions = transactions.slice(startIndex, startIndex + filters.limit);

      logger.debug(`Transactions fetched: total=${transactions.length}, paginated=${paginatedTransactions.length}`);

      return {
        transactions: paginatedTransactions,
        pagination: {
          page: filters.page,
          limit: filters.limit,
          total: transactions.length,
          pages: Math.ceil(transactions.length / filters.limit)
        }
      };
    } catch (error) {
      logger.error('Error fetching transactions:', error);
      throw error;
    }
  }


  async withdrawFunds(userId, withdrawalData) {
    try {
      const wallet = await Wallet.findOne({
        _id: withdrawalData.walletId,
        userId
      });

      if (!wallet) {
        throw new Error('Wallet not found');
      }

      // Verify sufficient balance (skip for external wallets as they are signed on frontend)
      if (wallet.type !== 'external') {
        const balance = wallet.balances.find(b => b.symbol === withdrawalData.asset);
        if (!balance || balance.amount < withdrawalData.amount) {
          throw new Error('Insufficient balance');
        }
      }

      // Handle withdrawal based on wallet type
      let withdrawal;
      switch (wallet.type) {
        case 'exchange':
          withdrawal = await this.handleExchangeWithdrawal(wallet, withdrawalData);
          break;
        case 'defi':
          withdrawal = await this.handleDefiWithdrawal(wallet, withdrawalData);
          break;
        case 'external':
          withdrawal = await this.handleExternalWithdrawal(wallet, withdrawalData);
          break;
        default:
          throw new Error('Unsupported wallet type');
      }

      // Create transaction record
      const transaction = new Transaction({
        userId,
        walletId: wallet._id,
        type: 'withdrawal',
        asset: withdrawalData.asset,
        amount: withdrawalData.amount,
        destinationAddress: withdrawalData.destinationAddress,
        network: withdrawalData.network,
        status: 'pending',
        txHash: withdrawal.txHash
      });

      await transaction.save();

      return {
        transaction,
        withdrawal
      };
    } catch (error) {
      logger.error('Error withdrawing funds:', error);
      throw error;
    }
  }

  async getDepositAddress(userId, { walletId, asset, network }) {
    const wallet = await Wallet.findOne({ _id: walletId, userId });
    if (!wallet) {
      const err = new Error('Wallet not found');
      err.status = 404;
      throw err;
    }

    // External / DeFi wallets: the wallet address IS the deposit address
    if (wallet.type === 'external' || wallet.type === 'defi') {
      return {
        address: wallet.address,
        tag:     null,
        network: network || wallet.network,
        note:    `Send ${asset} on ${network || wallet.network} to this address.`,
      };
    }

    // Exchange wallets: delegate to exchange-specific handler
    try {
      return await this.getExchangeDepositAddress(wallet, { asset, network });
    } catch (err) {
      logger.warn(`Exchange deposit address failed for ${wallet.provider}, falling back to wallet address:`, err.message);
      // Safe fallback — return wallet address rather than crashing
      return {
        address: wallet.address,
        tag:     null,
        network: network || wallet.network,
        note:    `Fallback: send ${asset} to this address.`,
      };
    }
  }

  // Private helper methods
  async updateWalletBalances(wallet) {
    try {
      switch (wallet.type) {
        case 'exchange': await this.updateExchangeWalletBalances(wallet); break;
        case 'defi':     await this.updateExternalWalletBalances(wallet); break; // DeFi = EOA, same as external
        case 'external': await this.updateExternalWalletBalances(wallet); break;
      }
      wallet.lastSyncedAt = new Date();
      await wallet.save();
      return wallet;
    } catch (error) {
      logger.error(`Error updating balances for wallet ${wallet._id}:`, error);
      return wallet;
    }
  }

async verifyWalletOwnership(address, signature) {
  try {
    const normalizedAddress = ethers.utils.getAddress(address);

    const message = `Connect wallet ${normalizedAddress} to NeoFin`;

    logger.debug(`Verifying wallet ownership for: ${normalizedAddress}`);

    const signerAddress = ethers.utils.verifyMessage(message, signature);

    if (signerAddress.toLowerCase() !== normalizedAddress.toLowerCase()) {
      logger.warn(`Address mismatch: expected=${normalizedAddress.toLowerCase()}, received=${signerAddress.toLowerCase()}`);
      throw new Error('Invalid signature');
    }

    logger.info(`Wallet ownership verified: ${normalizedAddress}`);
    return true;

  } catch (error) {
    logger.error(`Wallet verification error: ${error.message}`);
    throw new Error('Invalid signature: ' + error.message);
  }
}
  // Exchange wallet implementations
  async handleExchangeWithdrawal(wallet, withdrawalData) {
    try {
      if (wallet.provider === 'binance') {
        const withdrawal = await this.exchanges.binance.withdraw(
          withdrawalData.asset,
          withdrawalData.amount,
          withdrawalData.destinationAddress,
          withdrawalData.network,
          withdrawalData.memo
        );
        return withdrawal;
      }
      throw new Error('Unsupported exchange provider');
    } catch (error) {
      logger.error('Error handling exchange withdrawal:', error);
      throw error;
    }
  }

  async getExchangeDepositAddress(wallet, depositData) {
    try {
      if (wallet.provider === 'binance') {
        return this.exchanges.binance.getDepositAddress(
          depositData.asset,
          depositData.network
        );
      }
      throw new Error('Unsupported exchange provider');
    } catch (error) {
      logger.error('Error getting exchange deposit address:', error);
      throw error;
    }
  }

  async updateExchangeWalletBalances(wallet) {
    try {
      if (wallet.provider === 'binance') {
        const balances = await this.exchanges.binance.getBalances();
        wallet.balances = balances
          .filter(b => b.free + b.locked > 0)
          .map(balance => ({
            symbol:    balance.asset,
            amount:    balance.free + balance.locked,
            updatedAt: new Date(),
          }));
      } else {
        logger.warn(`No balance updater for exchange provider: ${wallet.provider}`);
      }
    } catch (error) {
      logger.error('Error updating exchange wallet balances:', error);
      // Don't throw — keep existing balances
    }
  }

  // DeFi wallet implementations
  async handleDefiWithdrawal(wallet, withdrawalData) {
    const signedTx = withdrawalData.signedTx || withdrawalData.txHash;
    if (!signedTx) {
      throw new Error('DeFi withdrawals must be signed on the frontend.');
    }
    return { txHash: signedTx, message: 'Withdrawal transaction submitted.' };
  }

  async getDefiDepositAddress(wallet, depositData) {
    return {
      address: wallet.address,
      network: depositData.network,
      asset: depositData.asset
    };
  }



  // External wallet implementations
  async handleExternalWithdrawal(wallet, withdrawalData) {
    const signedTx = withdrawalData.signedTx || withdrawalData.txHash;
    if (!signedTx) {
      throw new Error('External wallet withdrawals must be signed on the frontend.');
    }
    return { txHash: signedTx, message: 'Transaction submitted.' };
  }

  /**
   * Fetch ETH + known ERC-20 balances for an EOA address.
   * Works for both external and defi wallet types.
   */
  async updateExternalWalletBalances(wallet) {
    try {
      const provider = ethereumProvider;
      if (!provider) {
        logger.warn('No Ethereum provider available, skipping balance update');
        return;
      }

      const address = wallet.address;
      const balances = [];

      // ETH balance
      const ethBalance = await provider.getBalance(address);
      balances.push({
        symbol:    'ETH',
        amount:    parseFloat(ethers.formatEther(ethBalance)),
        updatedAt: new Date(),
      });

      // ERC-20 token balances (only on mainnet/mainnet-like networks)
      const network = (wallet.network || '').toLowerCase();
      const isMainnet = network === 'ethereum' || network === 'mainnet' || network === '1';

      if (isMainnet) {
        for (const token of KNOWN_TOKENS) {
          try {
            const contract = new ethers.Contract(token.address, ERC20_ABI, provider);
            const raw      = await contract.balanceOf(address);
            const amount   = parseFloat(ethers.utils.formatUnits(raw, token.decimals));
            if (amount > 0) {
              balances.push({ symbol: token.symbol, amount, updatedAt: new Date() });
            }
          } catch (tokenErr) {
            logger.debug(`Could not fetch ${token.symbol} balance:`, tokenErr.message);
          }
        }
      }

      wallet.balances = balances;
    } catch (error) {
      logger.warn('Could not update wallet balances (RPC unavailable):', error.message);
      if (!wallet.balances || wallet.balances.length === 0) {
        wallet.balances = [{ symbol: 'ETH', amount: 0, updatedAt: new Date() }];
      }
    }
  }

  normalizeNetwork(network) {
    if (!network) return 'ethereum';
    if (typeof network === 'string' && network.startsWith('0x')) {
      const chainId = parseInt(network, 16);
      const map = { 1: 'ethereum', 5: 'goerli', 11155111: 'sepolia', 137: 'polygon', 56: 'bsc', 42161: 'arbitrum', 10: 'optimism', 8453: 'base' };
      return map[chainId] || `chain-${chainId}`;
    }
    if (typeof network === 'number') {
      const map = { 1: 'ethereum', 5: 'goerli', 11155111: 'sepolia', 137: 'polygon', 56: 'bsc', 42161: 'arbitrum', 10: 'optimism', 8453: 'base' };
      return map[network] || `chain-${network}`;
    }
    const normalized = network.toLowerCase();
    const aliases = { mainnet: 'ethereum', eth: 'ethereum', matic: 'polygon', bnb: 'bsc', sep: 'sepolia', gor: 'goerli' };
    return aliases[normalized] || normalized;
  }

  /**
   * Get live gas prices from on-chain data
   */
  async getGasPrices() {
    const provider = ethereumProvider;
    if (!provider) return { slow: 15, medium: 25, fast: 40 };
    return getLiveGasPrices(provider);
  }
}

module.exports = new WalletService();