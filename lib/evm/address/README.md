# Address Book Helper

This module provides functionality for managing and using address books in your project. It allows you to map blockchain addresses to human-readable names, making it easier to identify addresses in logs, deployment outputs, and monitoring scripts.

## Features

- Read and parse CSV address book files
- Filter address book entries by chain ID
- Convert addresses to objects with explorer links and names
- Gracefully handle missing address book files

## Usage

### Setting Up Your Address Book

1. Create a CSV file named `safe-address-book-latest.csv` in this directory
2. Use the following format for your CSV:

```
address,name,chainId
0x1234567890123456789012345678901234567890,My Safe 1,1
0x2345678901234567890123456789012345678901,My Safe 2,56
```

> **Note**: An example file `safe-address-book-latest_example.csv` is provided as a template.

### Using the Address Book in Your Code

#### Reading the Address Book

```typescript
import { readAddressBook } from '../lib/evm/address/addressBookHelper';

// Read all entries
const allEntries = readAddressBook('./lib/evm/address/safe-address-book-latest.csv');

// Read entries for a specific chain
const ethereumEntries = readAddressBook('./lib/evm/address/safe-address-book-latest.csv', 1);
```

#### Creating an Address to Name Map

```typescript
import { getAddressToNameMap } from '../lib/evm/address/addressBookHelper';

// Get address to name mapping for all chains
const addressToNameMap = getAddressToNameMap('./lib/evm/address/safe-address-book-latest.csv');

// Get address to name mapping for a specific chain
const bscAddressToNameMap = getAddressToNameMap('./lib/evm/address/safe-address-book-latest.csv', 56);
```

#### Converting Addresses to Explorer Links with Names

```typescript
import { convertAddressesToExplorerLinksByNetwork } from '../lib/evm/address/convertAddresses';
import { getAddressToNameMap } from '../lib/evm/address/addressBookHelper';

// Load address book
const addressToNameMap = getAddressToNameMap('./lib/evm/address/safe-address-book-latest.csv', 1);

// Object with addresses
const myObject = {
  owner: '0x1234567890123456789012345678901234567890',
  treasury: '0x2345678901234567890123456789012345678901',
  nested: {
    admin: '0x3456789012345678901234567890123456789012'
  }
};

// Convert addresses to objects with explorer links and names
const result = convertAddressesToExplorerLinksByNetwork(myObject, 'mainnet', addressToNameMap);

// Result will be:
// {
//   owner: {
//     address: '0x1234567890123456789012345678901234567890',
//     explorer: 'https://etherscan.io/address/0x1234567890123456789012345678901234567890',
//     name: 'My Safe 1'
//   },
//   treasury: {
//     address: '0x2345678901234567890123456789012345678901',
//     explorer: 'https://etherscan.io/address/0x2345678901234567890123456789012345678901',
//     name: 'My Safe 2'
//   },
//   nested: {
//     admin: {
//       address: '0x3456789012345678901234567890123456789012',
//       explorer: 'https://etherscan.io/address/0x3456789012345678901234567890123456789012'
//     }
//   }
// }
```

## Error Handling

The address book helper functions will throw an error if the CSV file cannot be read or parsed. If you want to handle missing address book files gracefully, you can wrap the function calls in a try-catch block:

```typescript
import { getAddressToNameMap } from '../lib/evm/address/addressBookHelper';
import { logger } from '../../hardhat/utils';

let addressToNameMap;
try {
  addressToNameMap = getAddressToNameMap('./lib/evm/address/safe-address-book-latest.csv', 1);
} catch (error) {
  logger.warn(`Failed to load address book: ${error instanceof Error ? error.message : String(error)}`);
  addressToNameMap = {}; // Use empty map as fallback
}
```

## Privacy Considerations

The address book file (`safe-address-book-latest.csv`) is excluded from git via a local `.gitignore` file. This ensures that your personal address book is not committed to the repository.
