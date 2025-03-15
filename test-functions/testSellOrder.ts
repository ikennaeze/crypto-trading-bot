import { RestClientV5 } from 'bybit-api';
import * as dotenv from 'dotenv';

dotenv.config(); // Load environment variables

const apiKey = process.env.BYBIT_API_KEY || "";
const apiSecret = process.env.BYBIT_API_SECRET || "";

if (!apiKey || !apiSecret) {
  throw new Error('BYBIT_API_KEY and BYBIT_API_SECRET must be set in the environment variables.');
}

const client = new RestClientV5({
  key: apiKey,
  secret: apiSecret,
  testnet: false,
});

export async function getTrueMinSellQtyByTestOrder(tradingPair: string, sellQuantity: number) {
    let minSellQty = Math.round(sellQuantity); // Default from API
  
    while (true) {
        try {
            const response = await client.submitOrder({
                category: "spot",
                symbol: tradingPair,
                side: "Sell",
                orderType: "Market",
                qty: minSellQty.toString(),
            });
  
            if (response.retCode === 0) {
                console.log(`✔ Minimum sellable amount: ${minSellQty} XRP`);
                return minSellQty;
            } else {
                console.log(`✖ ${minSellQty} XRP too low: ${response.retMsg} \n\tTrying higher amount...`);
                minSellQty = parseFloat(Number(minSellQty + 0.1).toFixed(2)); // Increase by small increments
            }
        } catch (error: any) {
            console.error(`✖ Error testing sell order: ${error.message}`);
            return 1; // Default to 1 XRP if unsure
        }
    }
}