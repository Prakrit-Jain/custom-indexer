import {Address, ChainId,  NULL_ADDRESS, ProtocolIndex, TokenId} from './ProtocolIndex';

import {ethers } from 'ethers';
import {DelegationIndex} from "./DelegationIndex";

describe('DelegationIndexTest', () => {
    let index: DelegationIndex;

    let walletA : Address = ethers.Wallet.createRandom().address;
    let walletB : Address = ethers.Wallet.createRandom().address;
    let walletC : Address = ethers.Wallet.createRandom().address;
    let walletD : Address = ethers.Wallet.createRandom().address;
    let contractA : Address = ethers.Wallet.createRandom().address;
    let tokenA : TokenId = "1242421"
    let chainId : ChainId = "1";

    beforeEach(() => {
        index = new DelegationIndex();
    });

    test('noDelegationsAreUndefined', () => {
        expect(index.getDelegationForWalletToken(walletA, chainId, contractA, tokenA)).toBeUndefined()
    });

    test('warmXyzAddDelegation', () => {
        index.warmXyzAddDelegation(walletA, NULL_ADDRESS, walletB, chainId, 0)
        expect(index.getDelegationForWalletToken(walletA, chainId, contractA, tokenA)).toBe(walletB)
    });

    test('warmXyzTransferDelegation', () => {
        index.warmXyzAddDelegation(walletA, NULL_ADDRESS, walletB, chainId, 0)
        index.warmXyzAddDelegation(walletA, walletB, walletC, chainId, 0)
        expect(index.getDelegationForWalletToken(walletA, chainId, contractA, tokenA)).toBe(walletC)
    });

    test('warmXyzRemoveDelegation', () => {
        index.warmXyzAddDelegation(walletA, NULL_ADDRESS, walletB, chainId, 0)
        index.warmXyzAddDelegation(walletA, walletB, NULL_ADDRESS, chainId, 0)
        expect(index.getDelegationForWalletToken(walletA, chainId, contractA, tokenA)).toBeUndefined()
    });

    test('warmXyzExpireDelegations', () => {
        index.warmXyzAddDelegation(walletA, NULL_ADDRESS, walletB, chainId, 1)
        index.warmXyzAddDelegation(walletA, walletB, walletC, chainId, 1)
        index.warmXyzExpireDelegations(2)
        expect(index.getDelegationForWalletToken(walletA, chainId, contractA, tokenA)).toBeUndefined()
    });

    test('delegateXyzAllWallet', () => {
        index.delegateXyzAllWallet(walletA, walletB, chainId, true)
        expect(index.getDelegationForWalletToken(walletA, chainId, contractA, tokenA)).toBe(walletB)
    });

    test('delegateXyzAllWalletRemove', () => {
        index.delegateXyzAllWallet(walletA, walletB, chainId, true)
        index.delegateXyzAllWallet(walletA, walletB, chainId, false)
        expect(index.getDelegationForWalletToken(walletA, chainId, contractA, tokenA)).toBeUndefined()
    });

    test('delegateXyzContract', () => {
        index.delegateXyzContract(walletA, walletB, chainId, contractA, true)
        expect(index.getDelegationForWalletToken(walletA, chainId, contractA, tokenA)).toBe(walletB)
    });

    test('delegateXyzContractRemove', () => {
        index.delegateXyzContract(walletA, walletB, chainId, contractA, true)
        index.delegateXyzContract(walletA, walletB, chainId, contractA, false)
        expect(index.getDelegationForWalletToken(walletA, chainId, contractA, tokenA)).toBeUndefined()
    });

    test('delegateXyzToken', () => {
        index.delegateXyzToken(walletA, walletB, chainId, contractA, tokenA, true)
        expect(index.getDelegationForWalletToken(walletA, chainId, contractA, tokenA)).toBe(walletB)
    });

    test('delegateXyzTokenRemove', () => {
        index.delegateXyzToken(walletA, walletB, chainId, contractA, tokenA, true)
        index.delegateXyzToken(walletA, walletB, chainId, contractA, tokenA, false)
        expect(index.getDelegationForWalletToken(walletA, chainId, contractA, tokenA)).toBeUndefined()
    });

    test('lastValidDelegationWins', () => {
        index.delegateXyzAllWallet(walletA, walletB, chainId, true)
        index.delegateXyzContract(walletA, walletC, chainId, contractA, true)
        index.delegateXyzToken(walletA, walletD, chainId, contractA, tokenA, true)
        expect(index.getDelegationForWalletToken(walletA, chainId, contractA, tokenA)).toBe(walletD)
    });
});