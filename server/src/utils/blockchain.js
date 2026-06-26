'use strict';

const { ethers } = require('ethers');
const { logger } = require('../api/middlewares/logger.middleware');

const getGasPrice = async (provider) => {
  try {
    const feeData = await provider.getFeeData();          // ethers v6
    return feeData.gasPrice ?? ethers.utils.parseUnits('20', 'gwei');
  } catch (error) {
    logger.error('Error getting gas price:', error.message);
    throw error;
  }
};

const optimizeGasPrice = async (provider) => {
  try {
    const feeData = await provider.getFeeData();           // ethers v6
    const base    = feeData.gasPrice ?? ethers.utils.parseUnits('20', 'gwei');
    return {
      maxFeePerGas:         base * 2n,
      maxPriorityFeePerGas: feeData.maxPriorityFeePerGas ?? ethers.utils.parseUnits('1.5', 'gwei'),
    };
  } catch (error) {
    logger.error('Error optimizing gas price:', error.message);
    throw error;
  }
};

const estimateGas = async (provider, transaction) => {
  try {
    return await provider.estimateGas(transaction);
  } catch (error) {
    logger.error('Error estimating gas:', error.message);
    throw error;
  }
};

const waitForTransaction = async (provider, txHash, confirmations = 1) => {
  try {
    return await provider.waitForTransaction(txHash, confirmations);
  } catch (error) {
    logger.error('Error waiting for transaction:', error.message);
    throw error;
  }
};

/**
 * Fetch live gas prices in Gwei from a provider.
 * Returns { slow, medium, fast } as numbers.
 */
const getLiveGasPrices = async (provider) => {
  try {
    const feeData = await provider.getFeeData();
    const baseGwei = feeData.gasPrice
      ? Number(ethers.utils.formatUnits(feeData.gasPrice, 'gwei'))
      : 20;
    return {
      slow:   Math.round(baseGwei * 0.8),
      medium: Math.round(baseGwei),
      fast:   Math.round(baseGwei * 1.4),
    };
  } catch (err) {
    logger.warn('Could not fetch live gas prices, using defaults:', err.message);
    return { slow: 15, medium: 25, fast: 40 };
  }
};

module.exports = { getGasPrice, optimizeGasPrice, estimateGas, waitForTransaction, getLiveGasPrices };