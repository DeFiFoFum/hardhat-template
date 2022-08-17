<img src="https://avatars.githubusercontent.com/u/78645267?v=4" alt="DeFiFoFum Avatar" width="100px"> 

# Hardhat Template - _by [DeFiFoFum](https://github.com/defifofum)_
Solidity Smart Contract development template using modern Web3 frameworks/tools including Hardhat, Waffle, Typechain and more. 


## Features
<!-- TODO: 
- [ ] Setup tsconfig.json so that a build will output contract artifacts and types 
- [ ] Add scripts to enforce styling on commits
- [ ] Network helpers? https://hardhat.org/hardhat-network-helpers/docs/reference 
- [ ] Create a test-helper library to deploy a mock-dex and mock-farm
- [ ] Coverage reporting
- [ ] Add hardhat features to the features list below?
- [ ] README.md how to create a new task (reference the readme.md in the template?)
-->

- Typescript
- Solidity Coverage
- Linting
  - [Prettier](https://prettier.io/): Most popular opinionated code formatter.
    - [Prettier Config](https://prettier.io/docs/en/configuration.html)
  - [Prettier Solidity plugin](https://www.npmjs.com/package/prettier-plugin-solidity): A Prettier plugin for automatically formatting your Solidity code.
  - [Solhint](https://www.npmjs.com/package/solhint): Open source project for linting Solidity code. This project provides both Security and Style Guide validations.
- Typechain

## Deployment and Verification
This project uses special tasks, adapted from Balancer protocol, to deploy and verify contracts which provides methods for saving custom outputs and easily verifying contracts as well as compartmentalizing different types of deployments.

**Configuration**
- Copy [.env.example](./.env.example) and rename to `.env`
  - Provide the necessary `env` variables before deployment/verification.
- [hardhat.config.ts](./hardhat.config.ts): Can be configured with additional networks if needed

## Deployment 
`npx hardhat deploy --id <task-id> --network <network-name> [--key <apiKey> --force --verbose]`  

This will deploy the example task to `bscTestnet`:  
eg: `npx hardhat deploy --id 20220816-deploy-lock --network bscTestnet`  

## Verification
`npx hardhat verify-contract --id <task-id> --network <network-name> --address <contract-address> [--args <constructor-args --key <apiKey> --force --verbose]`  

This will verify the example task deployed to `bscTestnet`:  
eg: `npx hardhat deploy --id 20220816-deploy-lock --network bscTestnet`  

<!-- 
NOTE: This feature is deprecated until @nomiclabs/hardhat-etherscan can be upgraded

To list the available networks for verification run the command below. API keys for any network in this list can be added to 
`npx hardhat verify --list-networks` 
-->

## Linting
This project uses Prettier, an opinionated code formatter, to keep code styles consistent. This project has additional plugins for Solidity support as well. 

### Linting Solidity Code
- [prettier.config.js](./prettier.config.js): Provide config settings for Solidity under `overrides`.
- [.solhint.json](./.solhint.json): Provide config settings for `solhint`.  

Check solidity files:  
`yarn lint:sol`  
  
Fix Solidity files:  
`yarn lint:sol:fix`  