# Hardhat Template Gotchas

- [Hardhat Template Gotchas](#hardhat-template-gotchas)
  - [`hardhat` + `ethers` Dependency Hell](#hardhat--ethers-dependency-hell)
  - [Foundry Dependencies](#foundry-dependencies)
    - [Fix: Foundry Dependencies](#fix-foundry-dependencies)

## `hardhat` + `ethers` Dependency Hell

- [@typechain/hardhat@7.0.0]([@typechain/ethers-v5@11.0.0](https://github.com/dethcrypto/TypeChain/releases/tag/%40typechain%2Fhardhat%407.0.0)) This repo uses ethers-v5 as all of the support scripts would need to be refactored for `ethers-v6` unfortunately. Because of this, the proper version dependencies need to be pinned for various packages which still use `ethers-v5`
  - `@typechain/ethers-v5@11.0.0`
  - `typechain@8.2.0`

## Foundry Dependencies

This happens when running a command like `forge inspect`.

```bash
# Error message:
Error (6275): Source "@openzeppelin/contracts-upgradeable/..." not found: File not found.
```

### Fix: Foundry Dependencies

Update the `remappings` in the `[foundry.toml](./foundry.toml)` file to point to the correct path:

```toml
remappings = [
    "@openzeppelin/contracts/=node_modules/@openzeppelin/contracts/",
    "@openzeppelin/contracts-upgradeable/=node_modules/@openzeppelin/contracts-upgradeable/",
] 
```
