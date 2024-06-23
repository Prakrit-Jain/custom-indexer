import {Address, NULL_ADDRESS, ProtocolIndex} from './ProtocolIndex';

import {ethers } from 'ethers';
import {DelegationIndex} from "./DelegationIndex";

describe('ProtocolIndex', () => {
    let index: ProtocolIndex;
    let delegateIndex: DelegationIndex;

    let walletA : Address = ethers.Wallet.createRandom().address;
    let walletB : Address = ethers.Wallet.createRandom().address;
    let walletC : Address = ethers.Wallet.createRandom().address;
    let contractA : Address = ethers.Wallet.createRandom().address;
    let chainId : string = "1";

    beforeEach(() => {
        delegateIndex = new DelegationIndex();
        index = new ProtocolIndex(delegateIndex);
    });

    test('mint', () => {
        index.transfer(NULL_ADDRESS, walletA, chainId, contractA, "1")
        const tokenRef = `${chainId}:${contractA}:1`
        const balance = index.getWallet(walletA);

        expect(balance.ownedTokens[0]).toEqual(tokenRef)
        expect(balance.delegatedTokens.length).toEqual(0)
        expect(balance.undelegatedTokens[0]).toEqual(tokenRef)
    });

    test('transfer', () => {
        index.transfer(NULL_ADDRESS, walletA, chainId, contractA, "1")
        index.transfer(walletA, walletB, chainId, contractA, "1")
        const tokenRef = `${chainId}:${contractA}:1`
        const balanceA = index.getWallet(walletA);
        const balanceB = index.getWallet(walletB);

        expect(balanceA.ownedTokens.length).toEqual(0)
        expect(balanceA.delegatedTokens.length).toEqual(0)
        expect(balanceA.undelegatedTokens.length).toEqual(0)

        expect(balanceB.ownedTokens[0]).toEqual(tokenRef)
        expect(balanceB.delegatedTokens.length).toEqual(0)
        expect(balanceB.undelegatedTokens[0]).toEqual(tokenRef)
    })

    test('transitiveTransfer', () => {
        index.transfer(NULL_ADDRESS, walletA, chainId, contractA, "1")
        index.transfer(walletA, walletB, chainId, contractA, "1")
        index.transfer(walletB, walletC, chainId, contractA, "1")
        const tokenRef = `${chainId}:${contractA}:1`
        const balanceA = index.getWallet(walletA);
        const balanceB = index.getWallet(walletB);
        const balanceC = index.getWallet(walletC);

        expect(balanceA.ownedTokens.length).toEqual(0)
        expect(balanceA.delegatedTokens.length).toEqual(0)
        expect(balanceA.undelegatedTokens.length).toEqual(0)

        expect(balanceB.ownedTokens.length).toEqual(0)
        expect(balanceB.delegatedTokens.length).toEqual(0)
        expect(balanceB.undelegatedTokens.length).toEqual(0)

        expect(balanceC.ownedTokens[0]).toEqual(tokenRef)
        expect(balanceC.delegatedTokens.length).toEqual(0)
        expect(balanceC.undelegatedTokens[0]).toEqual(tokenRef)
    });

    test('delegate', () => {
        index.transfer(NULL_ADDRESS, walletA, chainId, contractA, "1")
        delegateIndex.warmXyzAddDelegation(walletA, NULL_ADDRESS, walletB, chainId, 0)
        index.updateWalletDelegations(walletA)

        const tokenRef = `${chainId}:${contractA}:1`
        const balanceA = index.getWallet(walletA);
        const balanceB = index.getWallet(walletB);

        expect(balanceA.ownedTokens[0]).toEqual(tokenRef)
        expect(balanceA.delegatedTokens.length).toEqual(0)
        expect(balanceA.undelegatedTokens.length).toEqual(0)

        expect(balanceB.ownedTokens.length).toEqual(0)
        expect(balanceB.delegatedTokens[0]).toEqual(tokenRef)
        expect(balanceB.undelegatedTokens.length).toEqual(0)

        // add subsequent delegation
        delegateIndex.warmXyzAddDelegation(walletA, walletB, walletC, chainId, 0)
        index.updateWalletDelegations(walletA)

        const newBalanceB = index.getWallet(walletB);
        expect(newBalanceB.ownedTokens.length).toEqual(0)
        expect(newBalanceB.delegatedTokens.length).toEqual(0)
        expect(newBalanceB.undelegatedTokens.length).toEqual(0)

        const balanceC = index.getWallet(walletC);
        expect(balanceC.ownedTokens.length).toEqual(0)
        expect(balanceC.delegatedTokens[0]).toEqual(tokenRef)
        expect(balanceC.undelegatedTokens.length).toEqual(0)
    });

    test('dirtyTokenWhenUriChanged', () => {
        index.transfer(NULL_ADDRESS, walletA, chainId, contractA, "1")
        index.setTokenUri(chainId, contractA, "1", "ipfs://QmeSjSinHpPnmXmspMjwiXyN6zS4E9zccariGR3jxcaWtq/1")
        const tokenRef = `${chainId}:${contractA}:1`
        const dirtyTokens = index.flushDirtyTokens();
        expect(dirtyTokens.length).toEqual(1)
        expect(dirtyTokens[0]).toEqual(tokenRef)
    });

    test('hasToken', () => {
        index.transfer(NULL_ADDRESS, walletA, chainId, contractA, "1")
        const tokenRef = `${chainId}:${contractA}:1`
        expect(index.hasToken(tokenRef)).toEqual(true)
    })

    test('doesNotHaveToken', () => {
        const tokenRef = `${chainId}:${contractA}:1`
        expect(index.hasToken(tokenRef)).toEqual(false)
    });

    test('contractDirtyWhenNewToken', () => {
        index.transfer(NULL_ADDRESS, walletA, chainId, contractA, "1")
        const contractRef = `${chainId}:${contractA}`
        const dirtyContracts = index.flushDirtyContracts();
        expect(dirtyContracts.length).toEqual(1)
        expect(dirtyContracts[0]).toEqual(contractRef)
    })

    test('newMetadataExtensionMakesContractsDirty', () => {
        index.transfer(NULL_ADDRESS, walletA, chainId, contractA, "1")
        index.addMetadataExtension(chainId, contractA, "ipfs://QmeSjSinHpPnmXmspMjwiXyN6zS4E9zccariGR3jxcaWtq/{id}")
        const contractRef = `${chainId}:${contractA}`
        const dirtyContracts = index.flushDirtyContracts();
        expect(dirtyContracts.length).toEqual(1)
        expect(dirtyContracts[0]).toEqual(contractRef)

        const contractState = index.getContract(contractRef)
        expect(contractState.metadataExtensions.length).toEqual(1)
        expect(contractState.metadataExtensions[0]).toEqual("ipfs://QmeSjSinHpPnmXmspMjwiXyN6zS4E9zccariGR3jxcaWtq/{id}")
    });

    test('newMetadataExtensionMakesTokensDirty', () => {
        index.transfer(NULL_ADDRESS, walletA, chainId, contractA, "1")
        index.addMetadataExtension(chainId, contractA, "ipfs://QmeSjSinHpPnmXmspMjwiXyN6zS4E9zccariGR3jxcaWtq/{id}")
        const tokenRef = `${chainId}:${contractA}:1`
        const dirtyTokens = index.flushDirtyTokens();
        expect(dirtyTokens.length).toEqual(1)
        expect(dirtyTokens[0]).toEqual(tokenRef)

        const tokenState = index.getToken(tokenRef)
        expect(tokenState.metadataExtensions.length).toEqual(1)
        expect(tokenState.metadataExtensions[0]).toEqual("ipfs://QmeSjSinHpPnmXmspMjwiXyN6zS4E9zccariGR3jxcaWtq/1")
    })
});