const { Spot } = require('@binance/connector');
const { logger } = require('../../api/middlewares/logger.middleware');

class BinanceIntegration {
  constructor(apiKey, apiSecret) {
    this.client = new Spot(apiKey, apiSecret);
  }

  async getBalances() {
    try {
      const { data } = await this.client.account();
      return data.balances.map(balance => ({
        asset: balance.asset,
        free: parseFloat(balance.free),
        locked: parseFloat(balance.locked)
      }));
    } catch (error) {
      logger.error('Error fetching Binance balances:', error);
      throw error;
    }
  }

  async withdraw(asset, amount, address, network, memo = '') {
    try {
      const { data } = await this.client.withdraw(
        asset,
        address,
        amount,
        {
          network,
          memo
        }
      );
      return {
        id: data.id,
        txHash: data.txId
      };
    } catch (error) {
      logger.error('Error withdrawing from Binance:', error);
      throw error;
    }
  }

  async getDepositAddress(asset, network) {
    try {
      const { data } = await this.client.depositAddress(asset, {
        network
      });
      return {
        address: data.address,
        tag: data.tag,
        network: data.network,
        url: data.url
      };
    } catch (error) {
      logger.error('Error getting Binance deposit address:', error);
      throw error;
    }
  }
}

module.exports = BinanceIntegration;