import {ProtocolIndex, TokenState} from "./ProtocolIndex";
import {DelegationIndex} from "./DelegationIndex";
import {TokenUriFetcher} from "./TokenUriFetcher";
import {AsyncQueue} from "./AsyncQueue";
import {JsonRpcProvider} from "ethers";

describe('TokenMetadataUriFetcher',  () => {

    const rpcProviderUrl = "https://eth-mainnet.g.alchemy.com/v2/-uawoYcc6fkMmTvpmLu2qvktZ2fhbZb1";
    const chainId = "1";
    let ownershipIndex: ProtocolIndex;
    let tokenUriFetcher: TokenUriFetcher;
    let queue: AsyncQueue;
    let provider : JsonRpcProvider

    beforeEach(() => {
        ownershipIndex = new ProtocolIndex(new DelegationIndex());
        queue = new AsyncQueue();
        provider = new JsonRpcProvider(rpcProviderUrl);
        tokenUriFetcher = new TokenUriFetcher("Ethereum", provider, chainId, ownershipIndex, queue, 100);
    });

    test('supportsErc721Metadata', async () => {
        const contract = "0xbc4ca0eda7647a8ab7c2061c2e118a18a936f13d";
        const result = await tokenUriFetcher.supportsErc721Metadata(contract);
        expect(result).toBe(true);
    });

    test('fetchUri', async () => {
        const contract = "0xbc4ca0eda7647a8ab7c2061c2e118a18a936f13d";
        const tokenId = "1";
        const result = await tokenUriFetcher.fetchUri(contract, tokenId);
        expect(result).toBe("ipfs://QmeSjSinHpPnmXmspMjwiXyN6zS4E9zccariGR3jxcaWtq/1");
    });

    test('running', async () => {
        // start the fetcher
        tokenUriFetcher.run();
        queue.enqueue({contract: "0xbc4ca0eda7647a8ab7c2061c2e118a18a936f13d", tokenId: "1"})
        queue.enqueue({contract: "0xbc4ca0eda7647a8ab7c2061c2e118a18a936f13d", tokenId: "2"})
        // sleep 5 seconds
        await new Promise(resolve => setTimeout(resolve, 2000));

        const dirtyTokens = ownershipIndex.flushDirtyTokens();

        expect(dirtyTokens.length).toBe(2);

        const dirtyToken1 : TokenState = ownershipIndex.getToken(dirtyTokens[0]);
        const dirtyToken2 : TokenState = ownershipIndex.getToken(dirtyTokens[1]);
        expect(dirtyToken1.uri).toBe("ipfs://QmeSjSinHpPnmXmspMjwiXyN6zS4E9zccariGR3jxcaWtq/1");
        expect(dirtyToken2.uri).toBe("ipfs://QmeSjSinHpPnmXmspMjwiXyN6zS4E9zccariGR3jxcaWtq/2");

    }, 10000);
});