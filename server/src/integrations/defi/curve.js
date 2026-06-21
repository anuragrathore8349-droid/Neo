const axios = require('axios');

class CurveIntegration {
  // All pools with live APY from Curve's own API
  async getPools(network = 'ethereum') {
    const res = await axios.get(`https://api.curve.fi/api/getPools/${network}/main`);
    return res.data.data.poolData.map(pool => ({
      id: pool.id,
      name: pool.name,
      address: pool.address,
      tvl: pool.usdTotal,
      apy: pool.apy || 0,
      tokens: pool.coins.map(c => ({ symbol: c.symbol, address: c.address }))
    }));
  }

  // Single pool detail
  async getPool(poolAddress) {
    const pools = await this.getPools();
    return pools.find(p => p.address.toLowerCase() === poolAddress.toLowerCase());
  }

  // CRV staking APY from gauge data
  async getGaugeAPY(gaugeAddress) {
    const res = await axios.get('https://api.curve.fi/api/getGauges');
    const gauge = Object.values(res.data.data.gauges)
      .find(g => g.gauge.toLowerCase() === gaugeAddress.toLowerCase());
    return gauge?.apy || 0;
  }
}

module.exports = CurveIntegration;