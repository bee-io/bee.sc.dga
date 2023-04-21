# <img src="assets/logo.png" alt="B-ee" height="60px">

[![site](https://img.shields.io/badge/website-BEE-blue)](https://b-ee.io/)
[![OZ](https://img.shields.io/badge/library-OZ-green)](https://www.npmjs.org/package/@openzeppelin/contracts)

# Table of Contents

- Coin Flip DApp Smart Contracts
- Games
- Developer guide
- License

# Coin Flip DApp Smart Contracts

This repository contains the smart contracts for a decentralized games like Coin Flip built on EVM chains.

# Games

## CoinFlip

The game allows two players to bet on the outcome of a virtual coin flip. The contracts are written in Solidity and utilize the OpenZeppelin library for safe math and ERC20 operations.

# Developer guide

## Contracts

The main contracts in this repository are:

1. `IGamesManager.sol`: An interface for the Games Manager contract that manages game settings and random number requests.
2. `ICoinFlip.sol`: An interface for the Coin Flip game contract with function declarations for creating and managing games.
3. `RNAbstractGame.sol`: An abstract contract providing basic random number functionality for a game that requires random numbers.
4. `CoinFlip.sol`: The main Coin Flip game contract implementing the ICoinFlip and RNAbstractGame contracts.

## Setup

To install the required dependencies for this repository, make sure you have Node.js and npm installed, and then run:

```bash
$ git clone https://github.com/bee-io/bee.sc.dga
$ cd bee.sc.dga
$ npm install
```

This will install the required dependencies, including OpenZeppelin Contracts and Hardhat.

## Running Tests

---

To run the tests for the smart contracts, execute the following command:

```bash
$ npx hardhat test
```

This will run the test suite using Hardhat.

# License

sContracts is released under the [MIT License](LICENSE).
