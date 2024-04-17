# Hardhat Template Gotchas

## Dependency Hell

- [@typechain/hardhat@7.0.0]([@typechain/ethers-v5@11.0.0](https://github.com/dethcrypto/TypeChain/releases/tag/%40typechain%2Fhardhat%407.0.0)) This repo uses ethers-v5 as all of the support scripts would need to be refactored for `ethers-v6` unfortunately. Because of this, the proper version dependencies need to be pinned for various packages which still use `ethers-v5`
  - `@typechain/ethers-v5@11.0.0`
  - `typechain@8.2.0`
