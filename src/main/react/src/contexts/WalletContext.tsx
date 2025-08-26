import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react'
import { ethers } from 'ethers'
import { EAS_CONFIG, getNetworkName } from '../config/easConfig'

interface WalletContextType {
  address: string | null
  isConnected: boolean
  isConnecting: boolean
  network: string | null
  chainId: number | null
  provider: ethers.BrowserProvider | null
  signer: ethers.JsonRpcSigner | null
  connect: () => Promise<void>
  disconnect: () => void
  switchNetwork: (targetNetwork: string) => Promise<void>
}

const WalletContext = createContext<WalletContextType | undefined>(undefined)

export const useWallet = () => {
  const context = useContext(WalletContext)
  if (!context) {
    throw new Error('useWallet must be used within a WalletProvider')
  }
  return context
}

interface WalletProviderProps {
  children: ReactNode
}

export const WalletProvider: React.FC<WalletProviderProps> = ({ children }) => {
  const [address, setAddress] = useState<string | null>(null)
  const [isConnected, setIsConnected] = useState(false)
  const [isConnecting, setIsConnecting] = useState(false)
  const [network, setNetwork] = useState<string | null>(null)
  const [chainId, setChainId] = useState<number | null>(null)
  const [provider, setProvider] = useState<ethers.BrowserProvider | null>(null)
  const [signer, setSigner] = useState<ethers.JsonRpcSigner | null>(null)

  // Helper function now imported from config

  // Connect wallet function
  const connect = async () => {
    if (!window.ethereum) {
      alert('Please install a Web3 wallet (MetaMask, Phantom, Coinbase Wallet, etc.) to use this application')
      return
    }

    try {
      setIsConnecting(true)
      
      // Request account access
      const accounts = await window.ethereum.request({
        method: 'eth_requestAccounts',
      })

      if (accounts.length > 0) {
        const provider = new ethers.BrowserProvider(window.ethereum)
        const signer = await provider.getSigner()
        const network = await provider.getNetwork()
        
        setProvider(provider)
        setSigner(signer)
        setAddress(accounts[0])
        setChainId(Number(network.chainId))
        setNetwork(getNetworkName(Number(network.chainId)))
        setIsConnected(true)
        
        // Save connection state
        localStorage.setItem('wallet-connected', 'true')
      }
    } catch (error) {
      // Error handling - wallet connection failed
    } finally {
      setIsConnecting(false)
    }
  }

  // Disconnect wallet function
  const disconnect = () => {
    setAddress(null)
    setIsConnected(false)
    setNetwork(null)
    setChainId(null)
    setProvider(null)
    setSigner(null)
    localStorage.removeItem('wallet-connected')
  }

  // Switch network function
  const switchNetwork = async (targetNetwork: string) => {
    if (!window.ethereum) return

    const targetChainId = EAS_CONFIG.chainIds[targetNetwork as keyof typeof EAS_CONFIG.chainIds]
    if (!targetChainId) return

    try {
      await window.ethereum.request({
        method: 'wallet_switchEthereumChain',
        params: [{ chainId: `0x${targetChainId.toString(16)}` }],
      })
    } catch (error: any) {
      // If the chain hasn't been added to MetaMask, add it
      if (error.code === 4902) {
        const networkConfig = {
          'base': {
            chainName: 'Base',
            rpcUrls: ['https://mainnet.base.org'],
            nativeCurrency: { name: 'ETH', symbol: 'ETH', decimals: 18 },
            blockExplorerUrls: ['https://basescan.org'],
          },
          'base-sepolia': {
            chainName: 'Base Sepolia',
            rpcUrls: ['https://sepolia.base.org'],
            nativeCurrency: { name: 'ETH', symbol: 'ETH', decimals: 18 },
            blockExplorerUrls: ['https://sepolia.basescan.org'],
          },
        }

        const config = networkConfig[targetNetwork as keyof typeof networkConfig]
        if (config) {
          await window.ethereum.request({
            method: 'wallet_addEthereumChain',
            params: [{
              chainId: `0x${targetChainId.toString(16)}`,
              ...config,
            }],
          })
        }
      }
    }
  }

  // Auto-connect on mount if previously connected
  useEffect(() => {
    const autoConnect = async () => {
      if (!window.ethereum || !localStorage.getItem('wallet-connected')) return

      try {
        const accounts = await window.ethereum.request({
          method: 'eth_accounts',
        })

        if (accounts.length > 0) {
          await connect()
        }
      } catch (error) {
        // Error handling - auto-connect failed
      }
    }

    autoConnect()
  }, [])

  // Listen for account and network changes
  useEffect(() => {
    if (!window.ethereum) return

    const handleAccountsChanged = (accounts: string[]) => {
      if (accounts.length === 0) {
        disconnect()
      } else {
        setAddress(accounts[0])
      }
    }

    const handleChainChanged = (chainId: string) => {
      const newChainId = parseInt(chainId, 16)
      setChainId(newChainId)
      setNetwork(getNetworkName(newChainId))
    }

    window.ethereum.on('accountsChanged', handleAccountsChanged)
    window.ethereum.on('chainChanged', handleChainChanged)

    return () => {
      window.ethereum.removeListener('accountsChanged', handleAccountsChanged)
      window.ethereum.removeListener('chainChanged', handleChainChanged)
    }
  }, [])

  const contextValue: WalletContextType = {
    address,
    isConnected,
    isConnecting,
    network,
    chainId,
    provider,
    signer,
    connect,
    disconnect,
    switchNetwork,
  }

  return (
    <WalletContext.Provider value={contextValue}>
      {children}
    </WalletContext.Provider>
  )
}

// Extend window type for TypeScript
declare global {
  interface Window {
    ethereum?: any
  }
}