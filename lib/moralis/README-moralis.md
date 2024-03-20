# Moralis Service

## Setup

1. Install dependencies: `yarn add -D @moralisweb3/common-evm-utils moralis`
2. Add API key to the `.env` file in the root of the project: `MORALIS_API_KEY=<your-api-key>`

## Usage

### Initialization

To use the MoralisService, you first need to get an instance of the service and start it.

```ts
import { MoralisService } from './lib/moralis/MoralisService'

// Initialize the MoralisService
const moralisService = MoralisService.getInstance()

// Start the service
await moralisService.start()
```

### Getting EVM Chain

To get the EVM chain for a specific network, use the getEvmChain method.

```ts
import { DeployableNetworks } from '../../scripts/deploy/deploy.config'

// Assuming 'bsc' is a supported network in DeployableNetworks
const evmChain = moralisService.getEvmChain('bsc')
```

### Retrieving Contract Events

To retrieve events for a specific contract, use the getContractEvents method.

```ts
import { GetContractEventsRequest } from '@moralisweb3/common-evm-utils'

const request: GetContractEventsRequest = {
  address: '0xContractAddress',
  chain: evmChain,
  // ... other request parameters
}

const events = await moralisService.getContractEvents(request)
```
