import { HardhatUserConfig } from "hardhat/config";
import * as dotenv from 'dotenv'
import "@nomicfoundation/hardhat-toolbox";
import "@nomiclabs/hardhat-etherscan"
import 'solidity-coverage'
import "hardhat-gas-reporter"

dotenv.config()

const config: HardhatUserConfig = {
  solidity: {
    version: "0.8.19",
    settings: {
      optimizer: {
        enabled: true,
        runs: 200
      }
    }
  },
  gasReporter: {
    enabled: true
  },
  etherscan: {
    apiKey: process.env.ETHERSCAN_API,
  },
};

export default config;
