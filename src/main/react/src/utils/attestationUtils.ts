/**
 * Utility functions for attestation-related operations
 */

/**
 * Get the color for attestation status based on validator trust
 */
export const getStatusColor = (isValidValidator: boolean): 'success' | 'warning' => {
  return isValidValidator ? 'success' : 'warning'
}

/**
 * Get the label for attestation status based on validator trust
 */
export const getStatusLabel = (isValidValidator: boolean): string => {
  return isValidValidator ? 'TRUSTED' : 'UNKNOWN'
}

/**
 * Get the color for network chip based on network name
 */
export const getNetworkColor = (network: string): 'primary' | 'secondary' | 'default' => {
  switch (network) {
    case 'base': return 'primary'
    case 'base-sepolia': return 'secondary'
    default: return 'default'
  }
}