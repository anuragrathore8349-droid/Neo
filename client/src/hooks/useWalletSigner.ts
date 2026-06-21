import { BrowserProvider } from 'ethers';
import { useState, useCallback } from 'react';

export function useWalletSigner() {
  const [isConnected, setIsConnected] = useState(false);
  const [address, setAddress] = useState<string | null>(null);
  const [chainId, setChainId] = useState<number | null>(null);

  const connect = useCallback(async () => {
    if (!window.ethereum) throw new Error('MetaMask not installed');
    const provider = new BrowserProvider(window.ethereum);
    await provider.send('eth_requestAccounts', []);
    const signer = await provider.getSigner();
    const addr = await signer.getAddress();
    const network = await provider.getNetwork();
    setAddress(addr);
    setChainId(network.chainId);
    setIsConnected(true);
    return signer;
  }, []);

  const sendTransaction = useCallback(async (unsignedTx: any) => {
    const provider = new BrowserProvider(window.ethereum);
    const signer = await provider.getSigner();
    const tx = await signer.sendTransaction(unsignedTx);
    return tx;
  }, []);

  const switchNetwork = useCallback(async (targetChainId: number) => {
    await window.ethereum.request({
      method: 'wallet_switchEthereumChain',
      params: [{ chainId: `0x${targetChainId.toString(16)}` }]
    });
  }, []);

  return { isConnected, address, chainId, connect, sendTransaction, switchNetwork };
}