<img src="https://avatars.githubusercontent.com/u/78645267?v=4" alt="DeFiFoFum Avatar" width="100px"> 

# Hardhat Template - _by [DeFiFoFum](https://github.com/defifofum)_
Solidity Smart Contract development template using modern Web3 frameworks/tools including Hardhat, Waffle, Typechain and more. 


## Features
<!-- TODO: Setup tsconfig.json so that a build will output contract artifacts and types -->

<!-- TODO: Add details -->
- Typescript
- Waffle
- Solidity Coverage
- Linting
  - [Prettier](https://prettier.io/): Most popular opinionated code formatter.
    - [Prettier Config](https://prettier.io/docs/en/configuration.html)
  - [Prettier Solidity plugin](https://www.npmjs.com/package/prettier-plugin-solidity): A Prettier plugin for automatically formatting your Solidity code.
  - [Solhint](https://www.npmjs.com/package/solhint): Open source project for linting Solidity code. This project provides both Security and Style Guide validations.
- Typechain

## Linting
This project uses Prettier, an opinionated code formatter, to keep code styles consistent. This project has additional plugins for Solidity support as well. 

### Linting Solidity Code
- [prettier.config.js](./prettier.config.js): Provide config settings for Solidity under `overrides`.
- [.solhint.json](./.solhint.json): Provide config settings for `solhint`.  

Check solidity files:  
`yarn lint:sol`  
  
Fix Solidity files:  
`yarn lint:sol:fix`  

<!--
TODO:
## Testing
- Coverage reporting
- Waffle
-->

<!-- TODO: Replace with project specific actions -->
## Sample Hardhat Project

This project demonstrates a basic Hardhat use case. It comes with a sample contract, a test for that contract, and a script that deploys that contract.

Try running some of the following tasks:

```shell
npx hardhat help
npx hardhat test
GAS_REPORT=true npx hardhat test
npx hardhat node
npx hardhat run scripts/deploy.ts
```