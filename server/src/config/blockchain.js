'use strict';

const { ethers } = require('ethers');
const { logger } = require('../api/middlewares/logger.middleware');

let ethereumProvider = null;
let polygonProvider = null;
let arbitrumProvider = null;
let solanaProvider = null;

// Ethers v5 — use ethers.providers.JsonRpcProvider
const createProvider = (url, name, chainId) => {
  try {
    // Verify ethers v5 structure
    if (!ethers.providers || !ethers.providers.JsonRpcProvider) {
      logger.error(`[${name}] ethers.providers.JsonRpcProvider not available. Ethers version check failed.`);
      return null;
    }

    // Create provider using ethers v5 API
    const provider = new ethers.providers.JsonRpcProvider(url, chainId);
    logger.info(`✓ ${name} provider initialized successfully (Ethers v${ethers.version})`);
    return provider;
  } catch (err) {
    logger.error(`[${name}] Failed to create provider:`, {
      error: err.message,
      stack: err.stack,
      url: url,
      errno: err.errno,
      code: err.code,
    });
    return null;
  }
};

// Initialize providers with proper chain IDs for ethers v5
ethereumProvider = createProvider('https://ethereum.publicnode.com', 'Ethereum', 1);
polygonProvider = createProvider('https://polygon-bor-rpc.publicnode.com', 'Polygon', 137);
arbitrumProvider = createProvider('https://arbitrum-one-rpc.publicnode.com', 'Arbitrum', 42161);

// Solana — keep as-is, separate SDK
try {
  const { Connection } = require('@solana/web3.js');
  solanaProvider = new Connection('https://api.mainnet-beta.solana.com', 'confirmed');
  logger.info('✓ Solana provider initialized successfully');
} catch (err) {
  logger.warn('[Solana] Not available:', {
    error: err.message,
    stack: err.stack,
  });
}

// Validate providers are initialized before export
const validateProviders = () => {
  const status = {
    ethereum: !!ethereumProvider,
    polygon: !!polygonProvider,
    arbitrum: !!arbitrumProvider,
    solana: !!solanaProvider,
  };
  
  const failed = Object.entries(status)
    .filter(([_, available]) => !available)
    .map(([name]) => name);
  
  if (failed.length > 0) {
    logger.warn(`[Blockchain] These providers failed to initialize: ${failed.join(', ')}`);
  }
  
  return status;
};

// Validate on startup
validateProviders();

module.exports = { 
  ethereumProvider, 
  polygonProvider, 
  arbitrumProvider, 
  solanaProvider,
  validateProviders,
};

