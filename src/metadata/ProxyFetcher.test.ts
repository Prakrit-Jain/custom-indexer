import {ProxyFetcher} from "./ProxyFetcher";


describe('ProxyFetcher',  () => {

    let proxyFetcher: ProxyFetcher;

    beforeEach(() => {
        proxyFetcher = new ProxyFetcher();
    });

    test('supportsErc721Metadata', async () => {
        const result = await proxyFetcher.fetch("https://api.otherside.xyz/lands/93265");
        expect(result).toBeDefined()
        console.log(result.data)
    });

    test('gracefullyHandles404', async () => {
        const result = await proxyFetcher.fetch("https://goldenblobs.xyz/nft/73");
        expect(result).toStrictEqual({});
    }, 10000);

});