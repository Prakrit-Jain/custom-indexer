import {DelegationIndex} from "./DelegationIndex";
import {Contract} from "ethers";

export type Address = string
export type ChainId = string
export type TokenId = string
export type Timestamp = number
export type TokenRef = string
export type ContractRef = string

export const NULL_ADDRESS = "0x0000000000000000000000000000000000000000"

export type WalletBalance = {
    ownedTokens: TokenRef[]
    delegatedTokens: TokenRef[]
    undelegatedTokens: TokenRef[]
}

export type TokenState = {
    owner: Address
    delegation?: Address
    uri?: string
    metadataExtensions: string[]
}

export type ContractState = {
    tokens: TokenRef[]
    metadataExtensions: string[]
}

export class ProtocolIndex {

    private wallets : Record<Address, WalletIndex>

    private contracts : Record<Address, ContractIndex>

    private tokens : Record<TokenRef, TokenIndex>

    private delegationIndex : DelegationIndex

    private dirtyWallets : Set<Address>
    private dirtyTokens : Set<TokenRef>
    private dirtyContracts : Set<ContractRef>

    private latestBlocks : Record<ChainId, number>

    constructor(delegateIndex: DelegationIndex) {
        this.wallets = {}
        this.contracts = {}
        this.tokens = {}
        this.delegationIndex = delegateIndex
        this.dirtyWallets = new Set()
        this.dirtyTokens = new Set()
        this.dirtyContracts = new Set()
        this.latestBlocks = {}
    }

    updateWalletDelegations(wallet: Address): void {
        this.getWalletIndex(wallet).ownedTokens.forEach((tokenRef) => {
            this.updateTokenDelegations(tokenRef)
        });
    }

    transfer(from: Address, to: Address, chainId: ChainId, contract: Address, tokenId: TokenId): void {
        const tokenRef = `${chainId}:${contract}:${tokenId}`
        const contractRef = `${chainId}:${contract}`

        // console.log(`Transferring token ${tokenRef} from ${from} to ${to}`)
        if(from !== NULL_ADDRESS) {
            // assert that from owns the token
            if (!this.getWalletIndex(from).ownedTokens.has(tokenRef)) {
                throw new Error(`Wallet ${from} does not own token ${tokenRef}`)
            }

            this.getWalletIndex(from).ownedTokens.delete(tokenRef)
            this.getWalletIndex(from).undelegatedTokens.delete(tokenRef)
            this.dirtyWallets.add(from)
        }
        this.getWalletIndex(to).ownedTokens.add(tokenRef)
        this.dirtyWallets.add(to)
        if(!this.getContractIndex(contractRef).tokens.has(tokenRef)) {
            this.dirtyContracts.add(contractRef)
            this.getContractIndex(contractRef).tokens.add(tokenRef)
        }
        this.getTokenIndex(tokenRef).owner = to
        this.dirtyTokens.add(tokenRef)
        this.updateTokenDelegations(tokenRef)
    }

    setTokenUri(chainId: ChainId, contract: Address, tokenId: TokenId, uri: string): void {
        const tokenRef = `${chainId}:${contract}:${tokenId}`
        this.getTokenIndex(tokenRef).uri = uri
        this.dirtyTokens.add(tokenRef)
    }

    setLatestBlock(chainId: ChainId, blockNumber: number): void {
        this.latestBlocks[chainId] = blockNumber
    }

    getLatestBlocks(): Record<ChainId, number> {
        return this.latestBlocks
    }

    addMetadataExtension(chainId: ChainId, contract: Address, extensionUri: string): void {
        const contractRef = `${chainId}:${contract}`
        this.getContractIndex(contractRef).metadataExtensions.push(extensionUri)
        this.dirtyContracts.add(contractRef)
        // make every token dirty too - they all now have a new extension
        this.getContractIndex(contractRef).tokens.forEach((tokenRef) => {
            this.dirtyTokens.add(tokenRef)
        })
    }

    getWallet(address: Address): WalletBalance {
        const wallet = this.getWalletIndex(address)
        return {
            ownedTokens: Array.from(wallet.ownedTokens),
            delegatedTokens: Array.from(wallet.inboundDelegatedTokens),
            undelegatedTokens: Array.from(wallet.undelegatedTokens)
        }
    }

    getToken(tokenRef: TokenRef): TokenState {
        const parts = tokenRef.split(":")
        const chainId = parts[0]
        const contractAddress = parts[1]
        const tokenId = parts[2]
        const contractRef = `${chainId}:${contractAddress}`

        const token = this.getTokenIndex(tokenRef)
        const contract = this.getContractIndex(contractRef)

        const metadataExtensions = contract.metadataExtensions.map((extensionUri) => {
           return extensionUri.replace("{id}", tokenId)
        });

        return {
            owner: token.owner,
            delegation: token.delegation,
            uri: token.uri,
            metadataExtensions: metadataExtensions
        }
    }

    getContract(contractRef: ContractRef): ContractState {
        return {
            tokens: [...this.getContractIndex(contractRef).tokens],
            metadataExtensions: this.getContractIndex(contractRef).metadataExtensions
        }
    }

    hasToken(tokenRef: TokenRef): boolean {
        return tokenRef in this.tokens
    }

    flushDirtyWallets(): Array<Address> {
        const wallets = [...this.dirtyWallets]
        this.dirtyWallets.clear()
        return wallets
    }

    flushDirtyTokens(): Array<TokenRef> {
        const tokens = [...this.dirtyTokens]
        this.dirtyTokens.clear()
        return tokens
    }

    flushDirtyContracts(): Array<ContractRef> {
        const contracts = [...this.dirtyContracts]
        this.dirtyContracts.clear()
        return contracts
    }

    private getWalletIndex(address: Address): WalletIndex {
        if (!this.wallets[address]) {
            this.wallets[address] = new WalletIndex()
        }
        return this.wallets[address]
    }

    private getContractIndex(contract: ContractRef): ContractIndex {
        if (!this.contracts[contract]) {
            this.contracts[contract] = new ContractIndex()
        }
        return this.contracts[contract]
    }

    private getTokenIndex(tokenRef: TokenRef): TokenIndex {
        if (!this.tokens[tokenRef]) {
            this.tokens[tokenRef] = new TokenIndex()
        }
        return this.tokens[tokenRef]
    }
    private updateTokenDelegations(tokenRef: TokenRef): void {
        const [chainId, contract, tokenId] = tokenRef.split(":")
        const token = this.getTokenIndex(tokenRef)
        let newDelegatedOwner = this.delegationIndex.getDelegationForWalletToken(token.owner, chainId, contract, tokenId)
        if (newDelegatedOwner !== token.delegation) {
            if (token.delegation) {
                this.getWalletIndex(token.delegation).inboundDelegatedTokens.delete(tokenRef)
                this.dirtyWallets.add(token.delegation)
            }
            token.delegation = newDelegatedOwner
            this.dirtyTokens.add(tokenRef)
            if (newDelegatedOwner) {
                this.getWalletIndex(newDelegatedOwner).inboundDelegatedTokens.add(tokenRef)
                this.dirtyWallets.add(newDelegatedOwner)
            }
        }
        if(token.delegation) {
            this.getWalletIndex(token.owner).undelegatedTokens.delete(tokenRef)
            this.dirtyWallets.add(token.owner)
        }
        else {
            this.getWalletIndex(token.owner).undelegatedTokens.add(tokenRef)
            this.dirtyWallets.add(token.owner)
        }
    }
}

class WalletIndex {
    ownedTokens : Set<TokenRef>
    inboundDelegatedTokens : Set<TokenRef>
    undelegatedTokens : Set<TokenRef>

    constructor() {
        this.ownedTokens = new Set()
        this.inboundDelegatedTokens = new Set()
        this.undelegatedTokens = new Set()
    }
}

class ContractIndex {
    tokens : Set<TokenRef>
    metadataExtensions: Array<string>

    constructor() {
        this.tokens = new Set()
        this.metadataExtensions = []
    }
}

class TokenIndex {
    owner : Address
    delegation? : Address
    uri? : string

    constructor() {
        this.owner = NULL_ADDRESS
        this.delegation = undefined
        this.uri = undefined
    }
}