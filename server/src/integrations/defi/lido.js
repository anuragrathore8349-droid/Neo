'use strict';

const axios  = require('axios');
const ethers = require('ethers');

class LidoIntegration {
  constructor (provider) {
    this.provider     = provider;
    this.stETHAddress = '0xae7ab96520de3a18e5e111b5eaab095312d7fe84';
  }

  // Real live APR from Lido's own API
  async getAPR () {
    const res = await axios.get('https://eth-api.lido.fi/v1/protocol/steth/apr/last', { timeout: 5000 });
    const raw = res.data?.data?.apr;
    if (raw == null) throw new Error('Lido API returned no APR');
    const pct = parseFloat(raw);
    return pct < 1 ? pct * 100 : pct; // normalize: 0.0382 → 3.82
  }

  // Real TVL from on-chain totalSupply * ETH price
  async getTVL (ethPriceUSD) {
    const iface    = new ethers.utils.Interface(['function totalSupply() view returns (uint256)']);
    const contract = new ethers.Contract(this.stETHAddress, iface, this.provider);
    const supply   = await contract.totalSupply();
    const supplyEth = parseFloat(ethers.utils.formatEther(supply));
    return supplyEth * ethPriceUSD;
  }

  // Build unsigned stake transaction (ETH → stETH)  ← ethers v5 only
  async buildStakeCalldata (amountWei, referralAddress) {
    const ref   = referralAddress || ethers.constants.AddressZero;
    const iface = new ethers.utils.Interface(['function submit(address referral) payable returns (uint256)']);
    const data  = iface.encodeFunctionData('submit', [ref]);
    // amountWei can be BigNumber (v5) or string — normalise to hex string for MetaMask
    return {
      to:    this.stETHAddress,
      data,
      value: ethers.BigNumber.from(amountWei).toHexString()
    };
  }

  // User's stETH balance (their staking position)
  async getUserBalance (walletAddress) {
    const iface    = new ethers.utils.Interface(['function balanceOf(address) view returns (uint256)']);
    const contract = new ethers.Contract(this.stETHAddress, iface, this.provider);
    const balance  = await contract.balanceOf(walletAddress);
    return ethers.utils.formatEther(balance);
  }
}

module.exports = LidoIntegration;