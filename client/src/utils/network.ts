export const CHAIN_ID_TO_NETWORK: Record<string, string> = {
  '0x1':       'Ethereum',
  '0x5':       'Goerli',
  '0xaa36a7':  'Sepolia',
  '0x89':      'Polygon',
  '0x13881':   'Mumbai',
  '0x38':      'BSC',
  '0x61':      'BSC Testnet',
  '0xa4b1':    'Arbitrum One',
  '0x66eed':   'Arbitrum Goerli',
  '0xa':       'Optimism',
  '0x1a4':     'Optimism Goerli',
  '0x2105':    'Base',
  '0x14a33':   'Base Goerli',
  '0xe708':    'Linea',
  '0xe704':    'Linea Goerli',
  '0x82750':   'Scroll',
  '0x8274f':   'Scroll Sepolia',
  '0x144':     'zkSync Era',
  '0xa8c':     'Polygon zkEVM'
};

export function getNetworkName(chainId: string | null): string {
  if (!chainId) return 'Unknown';
  return CHAIN_ID_TO_NETWORK[chainId.toLowerCase()] || `Chain ${chainId}`;
}

export function getExplorerUrl(chainId: string | null, txHash: string): string {
  const explorers: Record<string, string> = {
    '0x1':     'https://etherscan.io/tx/',
    '0x89':    'https://polygonscan.com/tx/',
    '0xa4b1':  'https://arbiscan.io/tx/',
    '0xa':     'https://optimistic.etherscan.io/tx/',
    '0x2105':  'https://basescan.org/tx/',
    '0x38':    'https://bscscan.com/tx/',
    '0xe708':  'https://lineascan.build/tx/',
    '0x82750': 'https://scrollscan.com/tx/'
  };
  const base = chainId ? (explorers[chainId.toLowerCase()] || 'https://etherscan.io/tx/') : 'https://etherscan.io/tx/';
  return `${base}${txHash}`;
}