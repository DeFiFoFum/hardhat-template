import { utils, constants } from 'ethers'

// Address
export const ADDRESS_0 = '0x0000000000000000000000000000000000000000'
export const DEAD_ADDRESS = '0x000000000000000000000000000000000000dEaD'

// Integers
export const MAX_UINT256 = constants.MaxUint256.toString()

// Bytes
export const BYTES_32_0 = utils.formatBytes32String('')
export const BYTES_32 = (bytes: string) => utils.formatBytes32String(bytes)
