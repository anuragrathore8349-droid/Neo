export interface WalletTransaction {
  id: string;
  type: 'send' | 'receive' | 'swap' | 'approve' | 'transfer';
  hash: string;
  from: string;
  to: string;
  amount: string;
  asset: string;
  status: 'pending' | 'completed' | 'failed';
  timestamp: string;
  gasUsed?: string;
  gasPrice?: string;
}

export interface AddressBookEntry {
  id: string;
  name: string;
  address: string;
  network: string;
  notes?: string;
}

export interface GasPrice {
  slow: number;
  medium: number;
  fast: number;
}