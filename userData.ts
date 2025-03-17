import { CoinBalanceV5, RestClientV5, WalletBalanceV5, WalletBalanceV5Coin } from 'bybit-api';
import 'dotenv/config';

const apiKey = process.env.BYBIT_API_KEY!;
const apiSecret = process.env.BYBIT_API_SECRET!;

if (!apiKey || !apiSecret) {
  console.error("\x1b[31m%s\x1b[0m", '\t✖ Missing API credentials: Set BYBIT_API_KEY and BYBIT_API_SECRET in environment variables.');
}

const client = new RestClientV5({
  key: apiKey,
  secret: apiSecret,
  testnet: false, // Set to `true` for testnet
});

export async function getCoinInfo(desiredCoin: string): Promise<WalletBalanceV5Coin> {
  try {
    const response = await client.getWalletBalance({ accountType: 'UNIFIED' });

    if (response.retCode !== 0) {
      console.error("\x1b[31m%s\x1b[0m", `\t✖ Bybit API Error: ${response.retMsg} (Code: ${response.retCode})`);
    }

    const coinList = response.result?.list[0]?.coin
    const coin = coinList.filter(coin => coin.coin == desiredCoin)[0]

    return coin
  } catch (error) {
    console.error("\x1b[31m%s\x1b[0m", `\t✖ Error fetching Unified Account balances:`, error);
    throw error;
  }
}

export async function getCoinBalances(): Promise<WalletBalanceV5Coin[]> {
  try {
    const response = await client.getWalletBalance({ accountType: 'UNIFIED' });

    if (response.retCode !== 0) {
      console.error("\x1b[31m%s\x1b[0m", `\t✖ Bybit API Error: ${response.retMsg} (Code: ${response.retCode})`);
    }

    const coinList = response.result?.list[0]?.coin

    return coinList
  } catch (error) {
    console.error("\x1b[31m%s\x1b[0m", `\t✖ Error fetching coin balances:`, error);
    throw error;
  }
}

