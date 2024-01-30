### Usage Examples for Deploying Gnosis Safe with CREATE2

The following examples demonstrate how to deploy a Gnosis Safe using the `getCREATE2SafeInitializer` helper function and the CREATE2 opcode for deterministic deployment. This guide assumes familiarity with Ethereum development tools such as Hardhat and Ethers.js.

#### Basic Deployment

This example shows how to deploy a Gnosis Safe with default options. It retrieves the necessary components for deployment, including the proxy factory, the Gnosis Safe singleton address, and the initializer data. Then, it deploys the Safe using a specified salt for deterministic address calculation.

```typescript
import { ethers } from 'hardhat';
import { getCREATE2SafeInitializer } from './path/to/helper';
import { logger } from 'ethers';

async function deployGnosisSafe() {
  const salt = ethers.utils.id("some unique string");
  
  const { proxyFactory, gnosisSafeSingleton_l2, initializer } = await getCREATE2SafeInitializer();

  logger.logHeader('Deploying Gnosis Safe with CREATE2', '🚀');
  logger.warn('This script deploys the contract at the proper address, but the setup() function still needs to be called.');

  const tx = await proxyFactory.createProxyWithNonce(gnosisSafeSingleton_l2, initializer, salt);
  logger.log('Gnosis Safe deployment transaction sent. Tx Hash:', tx.hash);

  const receipt = await tx.wait();
  logger.log('Gnosis Safe deployed at:', receipt.events?.find(event => event.event === 'ProxyCreation')?.args?.proxy);
}

deployGnosisSafe().catch(console.error);
```

#### Advanced Deployment with Custom Options

In this example, we deploy a Gnosis Safe with custom deployment options, including specified owners and a threshold. This demonstrates how to use the `SafeDeploymentOptions` to customize the Safe deployment.

```typescript
import { ethers } from 'hardhat';
import { getCREATE2SafeInitializer } from './path/to/helper';
import { logger } from 'ethers';

async function deployCustomGnosisSafe() {
  const salt = ethers.utils.id("another unique string");
  const owners = ['0xOwnerAddress1', '0xOwnerAddress2'];
  const threshold = 2;

  const deploymentOptions = {
    owners,
    threshold,
  };

  const { proxyFactory, gnosisSafeSingleton_l2, initializer } = await getCREATE2SafeInitializer(deploymentOptions);

  logger.logHeader('Deploying Custom Gnosis Safe with CREATE2', '🚀');
  logger.warn('This script deploys the contract at the proper address, but the setup() function still needs to be called.');

  const tx = await proxyFactory.createProxyWithNonce(gnosisSafeSingleton_l2, initializer, salt);
  logger.log('Custom Gnosis Safe deployment transaction sent. Tx Hash:', tx.hash);

  const receipt = await tx.wait();
  const deployedAddress = receipt.events?.find(event => event.event === 'ProxyCreation')?.args?.proxy;
  logger.log('Custom Gnosis Safe deployed at:', deployedAddress);
}

deployCustomGnosisSafe().catch(console.error);
```

### Post-Deployment: Calling the `setup` Function

After deploying the Gnosis Safe contract, it's crucial to call the `setup` function to initialize the Safe with the correct owners and threshold. This step is not covered in the deployment examples above and should be implemented as part of the deployment process.

#### Example of Calling `setup` After Deployment

```typescript
// Assuming `deployedAddress` contains the address of the newly deployed Gnosis Safe
const gnosisSafe = await ethers.getContractAt('GnosisSafe', deployedAddress);

const setupTx = await gnosisSafe.setup(
  owners,
  threshold,
  ethers.constants.AddressZero,
  '0x',
  ethers.constants.AddressZero,
  ethers.constants.AddressZero,
  0,
  ethers.constants.AddressZero
);

await setupTx.wait();
logger.log('Gnosis Safe setup completed.');
```

This step finalizes the deployment and configuration of the Gnosis Safe, making it ready for use.
