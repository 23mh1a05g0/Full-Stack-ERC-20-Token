import { defineConfig } from "hardhat/config";
import hardhatToolboxPlugin from "@nomicfoundation/hardhat-toolbox-mocha-ethers";
import * as dotenv from "dotenv";
dotenv.config();

export default defineConfig({
  plugins: [hardhatToolboxPlugin],
  solidity: {
    version: "0.8.20",
    settings: {
      optimizer: {
        enabled: true,
        runs: 200,
      },
    },
  },
  networks: {
    localhost: {
      type: "http",
      url: "http://127.0.0.1:8545",
      chainType: "l1",
    },
    sepolia: {
      type: "http",
      url: process.env.SEPOLIA_RPC_URL || "https://rpc.sepolia.org",
      accounts: process.env.PRIVATE_KEY ? [process.env.PRIVATE_KEY] : [],
      chainType: "l1",
    },
  },
  etherscan: {
    apiKey: process.env.ETHERSCAN_API_KEY || "",
  },
});
