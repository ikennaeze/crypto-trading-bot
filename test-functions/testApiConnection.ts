import axios from "axios";
import { DefaultResponse } from "../interfaces/responses";
import * as dotenv from 'dotenv';
import { RestClientV5 } from "bybit-api";

dotenv.config(); // Load environment variables from .env file

// Safely retrieve environment variables
const apiKey = process.env.BYBIT_API_KEY || "";
const apiSecret = process.env.BYBIT_API_SECRET || "";

if (!apiKey || !apiSecret) {
  throw new Error('BYBIT_API_KEY and BYBIT_API_SECRET must be set in the environment variables.');
}

// Initialize the Bybit client
const client = new RestClientV5({
  key: apiKey,
  secret: apiSecret,
  testnet: false, // Set to true for testnet
});

export async function testApiConnection(): Promise<DefaultResponse> {
    try {
        // Use the correct method to fetch account information
        const response = await client.getQueryApiKey()

        // Check if the request was successful
        if (response.retCode === 0) {
            const apiKeyName = response.result.apiKey
            return {
                isSuccessful: true,
                message: `\t✔ API connected successfully! Your api key is ${apiKeyName}`,
                data: response.result
            };
        } else {
            return {
                isSuccessful: false,
                message: `\tAPI connected but has errors: ${response.retMsg}`,
                data: response
            };
        }
    } catch (error: any) {
        return {
            isSuccessful: false,
            message: "Could not connect to your API. Here's why: " + error.message,
            data: null
        };
    }
}