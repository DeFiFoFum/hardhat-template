# CREATE2 Salt Handling in CreateX

## Understanding Salt Transformation

When using the CreateX contract to deploy with CREATE2, it's crucial to understand how the salt is handled:

```
INPUT SALT                    GUARDED SALT                 CREATE2 ADDRESS    
──────────                    ────────────                 ───────────────    
What you provide              What CreateX computes         Final Address     
to the contract               internally via _guard()                         

┌─────────────────┐           ┌──────────────┐            ┌─────────────┐     
│ 20 bytes        │     ┌────>│              │            │             │     
│ (address/zeros) │     │     │  Computed    │ ──────────>│  Contract   │     
├─────────────────┤     │     │    Hash      │            │  Address    │     
│ 1 byte (flag)   │     │     │              │            │             │     
├─────────────────┤     │     └──────────────┘            └─────────────┘     
│ 11 bytes random │ ────┘                                                     
└─────────────────┘          ** Depends on protection type **                 
```

## Key Concepts

1. **Input Salt**: The raw salt value you pass to `deployCreate2()` 
   - This is what you provide to the contract
   - This is what you discover during vanity address generation

2. **Guarded Salt**: The salt after CreateX applies its `_guard()` function
   - This is what actually gets used in the CREATE2 address calculation
   - Varies based on the protection type you've chosen

3. **CREATE2 Address**: The resulting contract address
   - Calculated using the guarded salt, not the input salt
   - The address where your contract will be deployed

## Protection Types

The CreateX contract applies different transformations to your salt based on the protection flags:

| Type | First 20 bytes | Flag (byte 21) | Transformation | Effect |
|------|---------------|----------------|----------------|--------|
| NORMAL | Any value | Any value | Hashes the salt | No special protection |
| SENDER_PROTECTED | Sender address | 0x00 | Hashes salt with sender | Only specific sender can deploy |
| CROSS_CHAIN_PROTECTED | Zero address | 0x01 | Hashes salt with chain ID | Can't reuse same salt on different chains |
| SENDER_AND_CROSS_CHAIN_PROTECTED | Sender address | 0x01 | Hashes salt with sender and chain ID | Both protections |

## Important for Vanity Address Generation

When generating vanity addresses:

1. Make sure your address discovery uses the **same salt transformation** as CreateX
2. The vanity generator must:
   - Take the input salt
   - Apply the appropriate guarding logic 
   - Use the guarded salt to compute the CREATE2 address

Otherwise, discovered vanity addresses won't match what actually gets deployed!

## Contract Creation Event Parsing

When deploying contracts with CreateX, the transaction receipt contains information about the newly deployed contract. The `parseContractCreationEvents` method extracts this information:

```
TRANSACTION RECEIPT               EVENT PARSING                EXTRACTED DATA    
────────────────                  ─────────────                ───────────────    
ContractReceipt with              Multiple parsing              Contract Address   
events or contractAddress         strategies                    and Salt Value     

┌─────────────────┐             ┌──────────────┐             ┌─────────────┐     
│ Events Array    │──┐          │ Interface    │             │ Contract    │     
│ (may contain    │  │          │ Parsing      │             │ Address     │     
│ creation events)│  │──────────┤              │─────────────┤             │     
├─────────────────┤  │          └──────────────┘             │             │     
│ contractAddress │──┘                 │                     ├─────────────┤     
│ property        │                    │                     │ Salt Value  │     
└─────────────────┘                    ▼                     │ (if found)  │     
                                ┌──────────────┐             └─────────────┘     
                                │ Direct Topic │                                 
                                │ Extraction   │                                 
                                └──────────────┘                                 
```

The parser uses multiple strategies to extract the deployment information:

1. **Interface Parsing**: First attempts to parse events using the CreateX contract interface
2. **Topic Extraction**: If interface parsing fails, it extracts data directly from event topics
3. **Receipt Fallback**: If no events are found, it uses the `contractAddress` property from the receipt

This flexible approach ensures that contract addresses and salts can be retrieved even if:
- The event structure changes
- The event is emitted by a different contract
- No events are emitted but a contract is deployed

## CreateXDeployer Implementation

Our `CreateXDeployer` class:
- Handles all this complexity for you
- Provides the `getGuardedSalt()` method to compute the guarded salt
- Ensures `computeCreate2Address()` uses the guarded salt
- Validates the result after deployment
- Parses transaction receipts to extract contract addresses and salt values

When using vanity generated salts, be sure to pass them exactly as generated - the CreateXDeployer will handle the rest. 