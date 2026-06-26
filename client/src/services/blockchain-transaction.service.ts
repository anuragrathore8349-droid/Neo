import { apiFetch } from './api';

const ETHERSCAN_API_URL = 'https://api.etherscan.io/api';

export interface BlockchainTransaction {
  id: string;
  hash: string;
  from: string;
  to: string | null;
  value: string;
  asset: string;
  gasUsed: string;
  gasPrice: string;
  status: 'completed' | 'failed';
  timestamp: string;
  type: 'send' | 'receive' | 'transfer';
  network: string;
  blockNumber: string;
}

/**
 * Fetch real blockchain transactions for a MetaMask-connected address
 * Uses public Etherscan API (no backend dependency)
 */
export async function fetchBlockchainTransactionsFromMetaMask(
  address: string,
  etherscanApiKey?: string,
  limit: number = 100
): Promise<BlockchainTransaction[]> {
  try {
    if (!address) {
      throw new Error('Address is required');
    }

    // Public Etherscan API (limited rate but works without key)
    const apiKey = etherscanApiKey || '';
    const url = new URL(ETHERSCAN_API_URL);
    url.searchParams.append('module', 'account');
    url.searchParams.append('action', 'txlist');
    url.searchParams.append('address', address);
    url.searchParams.append('startblock', '0');
    url.searchParams.append('endblock', '99999999');
    url.searchParams.append('sort', 'desc');
    if (apiKey) {
      url.searchParams.append('apikey', apiKey);
    }

    const response = await fetch(url.toString());

    if (!response.ok) {
      console.error('Etherscan API error:', response.statusText);
      return [];
    }

    const data = await response.json();

    if (data.status !== '1' || !Array.isArray(data.result)) {
      console.debug('No transactions found for address:', address);
      return [];
    }

    // Transform Etherscan transactions
    const transactions: BlockchainTransaction[] = data.result.slice(0, limit).map((tx: any) => {
      // Convert Wei to Ether
      const valueInEth = (BigInt(tx.value) / BigInt(10 ** 15)) / 1000;
      const gasPriceGwei = parseFloat(tx.gasPrice) / 1e9;

      // Determine transaction type
      const normalizedAddress = address.toLowerCase();
      const type =
        tx.from.toLowerCase() === normalizedAddress
          ? 'send'
          : tx.to && tx.to.toLowerCase() === normalizedAddress
          ? 'receive'
          : 'transfer';

      return {
        id: tx.hash,
        hash: tx.hash,
        from: tx.from,
        to: tx.to || null,
        value: valueInEth.toFixed(6),
        asset: 'ETH',
        gasUsed: tx.gas,
        gasPrice: gasPriceGwei.toFixed(2),
        status: tx.isError === '0' ? 'completed' : 'failed',
        timestamp: new Date(parseInt(tx.timeStamp) * 1000).toISOString(),
        type,
        network: 'Ethereum Mainnet',
        blockNumber: tx.blockNumber
      };
    });

    return transactions;
  } catch (error) {
    console.error('Error fetching blockchain transactions from Etherscan:', error);
    return [];
  }
}

/**
 * Cache fetched transactions on the backend
 */
export async function cacheBlockchainTransactions(
  walletId: string,
  transactions: BlockchainTransaction[]
): Promise<{ status: string; data: any }> {
  return apiFetch('/api/wallet/cache-transactions', {
    method: 'POST',
    body: {
      walletId,
      transactions
    }
  });
}
