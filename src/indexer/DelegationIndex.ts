import {Address, ChainId, NULL_ADDRESS, ProtocolIndex, Timestamp, TokenId} from "./ProtocolIndex";

type DelegationRecord = {
    type: "delegateXyzAll" | "delegateXyzContract" | "delegateXyzToken" | "warmXyz",
    from: Address,
    to: Address,
    chainId: ChainId,
    contract?: Address,
    tokenId?: TokenId
    expiry?: Timestamp
}

// Handles the delegation of ownership of tokens using Warm.xyz or Delegate.xyz V1 or V2
export class DelegationIndex {
    private index : Record<Address, DelegationRecord[]>
    private walletsWithExpiringDelegations: Set<Address>
    private getWalletDelegations(wallet: Address): DelegationRecord[] {
        if (!this.index[wallet]) {
            this.index[wallet] = []
        }
        return this.index[wallet]
    }

    constructor() {
        this.index = {}
        this.walletsWithExpiringDelegations = new Set<Address>()
    }

    // compute the delegation for a specific token of a specific wallet
    // in the case of ambiguous delegations, the most recent delegation is used across both protocols
    // Warm.XYZ supports "expiry" as a mechanism to remove delegations
    getDelegationForWalletToken(wallet: Address, chainId: ChainId, contract: Address, tokenId: TokenId): Address | undefined {
        let result = undefined
        this.getWalletDelegations(wallet).forEach((delegation) => {
            const validWarmDelegation = delegation.type === "warmXyz" && delegation.chainId === chainId
            const validDelegateXyzAllDelegation = delegation.type === "delegateXyzAll" && delegation.chainId === chainId
            const validDelegateXyzContractDelegation = delegation.type === "delegateXyzContract" && delegation.chainId === chainId && delegation.contract === contract
            const validDelegateXyzTokenDelegation = delegation.type === "delegateXyzToken" && delegation.chainId === chainId && delegation.contract === contract && delegation.tokenId === tokenId

            if(validWarmDelegation || validDelegateXyzAllDelegation || validDelegateXyzContractDelegation || validDelegateXyzTokenDelegation) {
                result = delegation.to
            }
        });
        return result;
    }

    warmXyzAddDelegation(coldWallet: Address, from: Address, to: Address, chainId: ChainId, expiry: Timestamp): void {
        // In the case this is a transfer of a delegation
        if(from !== NULL_ADDRESS) {
            // remove any existing delegations in the case the delegation is being transferred
            this.index[coldWallet] = this.getWalletDelegations(coldWallet).filter((delegation) => {
                return !(delegation.type === "warmXyz" && delegation.to === from)
            });
        }

        // If this is a delegation to a new address, add it
        if(to !== NULL_ADDRESS) {
            this.getWalletDelegations(coldWallet).push({
                type: "warmXyz",
                from: coldWallet,
                to: to,
                chainId: chainId,
                expiry: expiry
            })
            if(expiry !== 0) {
                this.walletsWithExpiringDelegations.add(coldWallet)
            }
        }
    }

    // Expire delegations and return wallets that need their delegations updated
    // TODO: for optimization remove delegations that are expired from the `walletsWithExpiringDelegations` if there are none left
    warmXyzExpireDelegations(time: Timestamp): Address[] {
        let result = [];
        this.walletsWithExpiringDelegations.forEach((wallet) => {
            this.index[wallet] = this.getWalletDelegations(wallet).filter((delegation) => {
                const delegationRemoval =  delegation.expiry < time || delegation.expiry === 0.0
                if(delegationRemoval) {
                    result.push(wallet)
                }
                return !delegationRemoval
            });
        })
        return [];
    }

    delegateXyzAllWallet(coldWallet: Address, to: Address, chainId: ChainId, enabled: boolean): void {
        if(!enabled) {
            this.index[coldWallet] = this.getWalletDelegations(coldWallet).filter((delegation) => {
                return !(delegation.type === "delegateXyzAll" && delegation.to === to)
            });
        }
        else {
            this.getWalletDelegations(coldWallet).push({
                type: "delegateXyzAll",
                from: coldWallet,
                to: to,
                chainId: chainId
            })
        }
    }

    delegateXyzContract(coldWallet: Address, to: Address, chainId: ChainId, contract: Address, enabled: boolean): void {
        if(!enabled) {
            this.index[coldWallet] = this.getWalletDelegations(coldWallet).filter((delegation) => {
                return !(delegation.type === "delegateXyzContract" && delegation.to === to && delegation.contract === contract)
            });
        }
        else {
            this.getWalletDelegations(coldWallet).push({
                type: "delegateXyzContract",
                from: coldWallet,
                to: to,
                chainId: chainId,
                contract: contract
            })
        }
    }
    delegateXyzToken(coldWallet: Address, to: Address, chainId: ChainId, contract: Address, tokenId: TokenId, enabled: boolean): void {
        if(!enabled) {
            this.index[coldWallet] = this.getWalletDelegations(coldWallet).filter((delegation) => {
                return !(delegation.type === "delegateXyzToken" && delegation.to === to && delegation.contract === contract && delegation.tokenId === tokenId)
            });
        }
        else {
            this.getWalletDelegations(coldWallet).push({
                type: "delegateXyzToken",
                from: coldWallet,
                to: to,
                chainId: chainId,
                contract: contract,
                tokenId: tokenId
            })
        }
    }
}