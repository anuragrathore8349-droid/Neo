const axios = require('axios');
const { ethers } = require('ethers');

class LidoIntegration {
  constructor(provider) {
    this.provider = provider;
    this.stETHAddress = '0xae7ab96520de3a18e5e111b5eaab095312d7fe84';
  }

  // Real live APR from Lido's own API
  async getAPR() {
    const res = await axios.get('https://eth-api.lido.fi/v1/protocol/steth/apr/last');
    return res.data.data.apr; // number like 3.82
  }

  // Real TVL from on-chain totalSupply * ETH price
  async getTVL(ethPriceUSD) {
    const iface = new ethers.utils.Interface(['function totalSupply() view returns (uint256)']);
    const contract = new ethers.Contract(this.stETHAddress, iface, this.provider);
    const supply = await contract.totalSupply();
    const supplyEth = parseFloat(ethers.formatEther(supply));
    return supplyEth * ethPriceUSD;
  }

  // Build unsigned stake transaction (ETH → stETH)
  async buildStakeCalldata(amountWei, referralAddress = ethers.ZeroAddress) {
    const iface = new ethers.utils.Interface(['function submit(address referral) payable returns (uint256)']);
    const data = iface.encodeFunctionData('submit', [referralAddress]);
    return { to: this.stETHAddress, data, value: amountWei.toString() };
  }

  // User's stETH balance (their staking position)
  async getUserBalance(walletAddress) {
    const iface = new ethers.utils.Interface(['function balanceOf(address) view returns (uint256)']);
    const contract = new ethers.Contract(this.stETHAddress, iface, this.provider);
    const balance = await contract.balanceOf(walletAddress);
    return ethers.formatEther(balance);
  }
}

module.exports = LidoIntegration;