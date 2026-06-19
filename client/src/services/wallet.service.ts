// FILE: src/services/wallet.service.ts
import { apiFetch } from './api';
import { AddressBookEntry } from '../types/wallet';

export interface WalletBalance {
  assetId?:   string;
  symbol:     string;
  amount:     number;
  usdValue?:  number;
  updatedAt?: string;
}

export interface WalletRecord {
  _id:          string;
  name:         string;
  type:         'exchange' | 'defi' | 'external';
  provider:     string;
  address:      string;
  network:      string;
  isVerified:   boolean;
  balances?:    WalletBalance[];
  lastSyncedAt?: string;
}

export interface DepositAddress {
  address: string;
  tag?:    string;
  network: string;
  url?:    string;
  note?:   string;
}

export interface GasPrice {
  slow:   number;
  medium: number;
  fast:   number;
}

export interface ConnectWalletPayload {
  name:       string;
  type:       'exchange' | 'defi' | 'external';
  provider:   string;
  address:    string;
  network:    string;
  signature?: string;
}

export interface WalletTransactionFilter {
  walletId?: string;
  page?:     number;
  limit?:    number;
  type?:     string;
}

// ── Wallet CRUD ───────────────────────────────────────────────────────────

export async function getWallets(): Promise<{ status: string; data: WalletRecord[] }> {
  const response = await apiFetch('/api/wallet');
  return { status: response.status || 'success', data: response.data || [] };
}

export async function connectWallet(
  payload: ConnectWalletPayload
): Promise<{ status: string; data: WalletRecord }> {
  const response = await apiFetch('/api/wallet/connect', { method: 'POST', body: payload });
  return { status: response.status || 'success', data: response.data || response };
}

export async function removeWallet(walletId: string): Promise<{ status: string }> {
  return apiFetch(`/api/wallet/${walletId}`, { method: 'DELETE' });
}

// ── Transactions ──────────────────────────────────────────────────────────

export interface WalletTransactionsResponse {
  transactions: any[];
  pagination: { page: number; limit: number; total: number; pages: number };
}

export async function getWalletTransactions(
  filters: WalletTransactionFilter
): Promise<{ status: string; data: WalletTransactionsResponse }> {
  const query = new URLSearchParams();
  if (filters.walletId) query.set('walletId', filters.walletId);
  query.set('page',  String(filters.page  || 1));
  query.set('limit', String(filters.limit || 50));
  query.set('type',  filters.type || 'all');

  const response = await apiFetch(`/api/wallet/transactions?${query.toString()}`);
  return {
    status: response.status || 'success',
    data:   response.data   || { transactions: [], pagination: { page: 1, limit: 50, total: 0, pages: 0 } },
  };
}

// ── Gas prices — from live on-chain endpoint ──────────────────────────────

export async function getGasPrices(): Promise<{ status: string; data: GasPrice }> {
  try {
    const response = await apiFetch('/api/wallet/gas-prices');
    return { status: 'success', data: response.data || { slow: 15, medium: 25, fast: 40 } };
  } catch {
    return { status: 'success', data: { slow: 15, medium: 25, fast: 40 } };
  }
}

// ── Deposit & Withdraw ────────────────────────────────────────────────────

export async function getDepositAddress(payload: {
  walletId: string;
  asset:    string;
  network:  string;
}): Promise<{ status: string; data: DepositAddress }> {
  const response = await apiFetch('/api/wallet/deposit', { method: 'POST', body: payload });
  return { status: response.status || 'success', data: response.data || response };
}

export interface WithdrawPayload {
  walletId:           string;
  asset:              string;
  amount:             number;
  destinationAddress: string;
  network:            string;
  memo?:              string;
  twoFactorCode?:     string;
  signedTx?:          string;
}

export async function withdrawFunds(
  payload: WithdrawPayload
): Promise<{ status: string; data: any }> {
  const response = await apiFetch('/api/wallet/withdraw', { method: 'POST', body: payload });
  return { status: response.status || 'success', data: response.data || response };
}

// ── Address Book ──────────────────────────────────────────────────────────

export async function getAddressBook(): Promise<{ status: string; data: AddressBookEntry[] }> {
  const response = await apiFetch('/api/addressbook');
  return { status: response.status || 'success', data: response.data || [] };
}

export async function addAddressToBook(
  address: Omit<AddressBookEntry, 'id'>
): Promise<{ status: string; data: AddressBookEntry }> {
  const response = await apiFetch('/api/addressbook', { method: 'POST', body: address });
  return { status: response.status || 'success', data: response.data || response };
}

export async function updateAddressInBook(
  id:      string,
  updates: Partial<Omit<AddressBookEntry, 'id'>>
): Promise<{ status: string; data: AddressBookEntry }> {
  const response = await apiFetch(`/api/addressbook/${id}`, { method: 'PATCH', body: updates });
  return { status: response.status || 'success', data: response.data || response };
}

export async function deleteAddressFromBook(id: string): Promise<{ status: string }> {
  return apiFetch(`/api/addressbook/${id}`, { method: 'DELETE' });
}