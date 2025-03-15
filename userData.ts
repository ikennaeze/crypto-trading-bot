import { CoinBalanceV5, RestClientV5, WalletBalanceV5 } from 'bybit-api';
import 'dotenv/config';

const apiKey = process.env.BYBIT_API_KEY!;
const apiSecret = process.env.BYBIT_API_SECRET!;

if (!apiKey || !apiSecret) {
  throw new Error('❌ Missing API credentials: Set BYBIT_API_KEY and BYBIT_API_SECRET in environment variables.');
}

const client = new RestClientV5({
  key: apiKey,
  secret: apiSecret,
  testnet: false, // Set to `true` for testnet
});

export async function getAvailableBalance(desiredCoin: string): Promise<number> {
  try {
    const response = await client.getWalletBalance({ accountType: 'UNIFIED' });

    if (response.retCode !== 0) {
      throw new Error(`Bybit API Error: ${response.retMsg} (Code: ${response.retCode})`);
    }

    const coinList = response.result?.list[0]?.coin
    const coinBalance = coinList.filter(coin => coin.coin == desiredCoin)[0].walletBalance

    return Number(coinBalance)
  } catch (error) {
    console.error(`❌ Error fetching Unified Account balances:`, error);
    throw error;
  }
}
