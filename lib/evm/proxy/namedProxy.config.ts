import { askYesOrNoQuestion } from '../../prompts/promptUser'

/**
 * NOTE: Used for Named Proxy vanity deployments.
 */
export const SUPPORTED_NAMED_PROXY_CONTRACT_NAMES = <const>['TransparentUpgradeableProxy', 'LockUpgradeableProxy']
export type SupportedNamedProxyContractNames = (typeof SUPPORTED_NAMED_PROXY_CONTRACT_NAMES)[number]

/**
 * Enforces the Named Proxy standard used in this repo.
 *
 * @param contractName - The name of the proxy contract to get the init code for.
 * @returns
 */
export async function formatNamedProxyContractName(contractName: string): Promise<SupportedNamedProxyContractNames> {
  let proxyContractName = contractName.endsWith('Proxy') ? contractName : `${contractName}Proxy`
  if (!SUPPORTED_NAMED_PROXY_CONTRACT_NAMES.includes(proxyContractName as SupportedNamedProxyContractNames)) {
    const shouldContinue = await askYesOrNoQuestion(
      `The contract name ${proxyContractName} is not included in SUPPORTED_NAMED_PROXY_CONTRACT_NAMES. Would you like to continue with the standard TransparentUpgradeableProxy?`,
    )
    if (!shouldContinue) {
      throw new Error(`Invalid named proxy contract name: ${proxyContractName}`)
    }
    proxyContractName = 'TransparentUpgradeableProxy'
  }
  return proxyContractName as SupportedNamedProxyContractNames
}
