// FILE: src/hooks/useMarketSocket.ts
// REPLACE ENTIRE FILE

import { useEffect, useRef, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';

interface PriceUpdate {
  symbol:    string;
  price:     number;
  change24h: number;
  volume24h: number;
  timestamp: number;
}

interface UseMarketSocketOptions {
  symbols:       string[];
  onPriceUpdate: (update: PriceUpdate) => void;
  enabled?:      boolean;
}

const SOCKET_URL    = (import.meta as any).env?.VITE_WS_URL || window.location.origin;
const MAX_RETRIES   = 5;
const BASE_DELAY_MS = 2_000;

export const useMarketSocket = ({
  symbols, onPriceUpdate, enabled = true
}: UseMarketSocketOptions) => {
  const socketRef       = useRef<Socket | null>(null);
  const retriesRef      = useRef(0);
  const reconnectTimer  = useRef<ReturnType<typeof setTimeout>>();
  const mountedRef      = useRef(true);
  // Always-current symbols ref — avoids stale closure in connect()
  const symbolsRef      = useRef<string[]>(symbols);
  const onUpdateRef     = useRef(onPriceUpdate);

  // Keep refs in sync
  useEffect(() => { symbolsRef.current = symbols; }, [symbols]);
  useEffect(() => { onUpdateRef.current = onPriceUpdate; }, [onPriceUpdate]);

  const scheduleReconnect = useCallback(() => {
    if (!mountedRef.current) return;
    if (retriesRef.current >= MAX_RETRIES) {
      console.warn('[MarketSocket] Max retries reached — falling back to HTTP polling');
      return;
    }
    const delay = BASE_DELAY_MS * Math.pow(2, retriesRef.current);
    retriesRef.current += 1;
    reconnectTimer.current = setTimeout(() => {
      if (mountedRef.current) connect();
    }, delay);
  }, []);

  const connect = useCallback(() => {
    if (!enabled || !mountedRef.current) return;

    socketRef.current?.removeAllListeners();
    socketRef.current?.disconnect();
    socketRef.current = null;

    const socket = io(`${SOCKET_URL}/market`, {
      transports: ['websocket', 'polling'],
      timeout:    10_000,
      reconnection: false,
      withCredentials: true
    });
    socketRef.current = socket;

    socket.on('connect', () => {
      retriesRef.current = 0;
      // Use ref — always current symbols, even if closure is stale
      if (symbolsRef.current.length > 0) {
        socket.emit('subscribe', symbolsRef.current);
      }
    });

    socket.on('priceUpdate', (data: PriceUpdate) => {
      if (mountedRef.current) onUpdateRef.current(data);
    });

    socket.on('disconnect', (reason) => {
      if (reason === 'io server disconnect') scheduleReconnect();
    });

    socket.on('connect_error', () => scheduleReconnect());
  }, [enabled, scheduleReconnect]);

  useEffect(() => {
    mountedRef.current = true;
    connect();
    return () => {
      mountedRef.current = false;
      clearTimeout(reconnectTimer.current);
      socketRef.current?.removeAllListeners();
      socketRef.current?.disconnect();
    };
  }, [connect]);

  // Re-subscribe when symbol list changes while connected
  useEffect(() => {
    const socket = socketRef.current;
    if (!socket?.connected || symbols.length === 0) return;
    socket.emit('subscribe', symbols);
    return () => { socket.emit('unsubscribe', symbols); };
  }, [symbols]);
};