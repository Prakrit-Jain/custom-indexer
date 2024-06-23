import {ethers, JsonRpcProvider, Log} from 'ethers';
import {AsyncQueue} from "./AsyncQueue";
import {Address} from "./ProtocolIndex";
import {LogParser} from "./LogParser";
import {exponentialBackoffRetry} from "../util";


const ERC721_TRANSFER_TOPIC = ethers.id("Transfer(address,address,uint256)");
export const WARM_XYZ_CONTRACT = "0xC3AA9bc72Bd623168860a1e5c6a4530d3D80456c"
export const WARM_WALLET_TOPIC = ethers.id("HotWalletChanged(address,address,address,uint256)");
export const DELEGATE_V1_CONTRACT = "0x00000000000076A84feF008CDAbe6409d2FE638B"
export const DELEGATE_V1_DELEGATE_ALL = "0x58781eab4a0743ab1c285a238be846a235f06cdb5b968030573a635e5f8c92fa"
export const DELEGATE_V1_DELEGATE_TOKEN = "0xe89c6ba1e8957285aed22618f52aa1dcb9d5bb64e1533d8b55136c72fcf5aa5d"
export const DELEGATE_v1_DELEGATE_CONTRACT = "0x8d6b2f5255b8d815cc368855b2251146e003bf4e2fcccaec66145fff5c174b4f"
export const DELEGATE_V2_CONTRACT = "0x00000000000000447e69651d841bD8D104Bed493"
export const DELEGATE_V2_DELEGATE_ALL = "0xda3ef6410e30373a9137f83f9781a8129962b6882532b7c229de2e39de423227"
export const DELEGATE_V2_DELEGATE_CONTRACT = "0x021be15e24de4afc43cfb5d0ba95ca38e0783571e05c12bbe6aece8842ae82df"
export const DELEGATE_V2_DELEGATE_ERC721 = "0x15e7a1bdcd507dd632d797d38e60cc5a9c0749b9a63097a215c4d006126825c6"
export const METADATA_EXTENSION_CONTRACT = "0xE2A9b2C04b06ba4F78b451e1727457a3e072F105"
export const METADATA_EXTENSION_SET = "0x2a82e9487edda2fe780020f7777d8c2c5d83d37c16c7e30b1a66d455be576f67"

export class LogFetcher {
    private provider: ethers.JsonRpcProvider;
    private batchSizePerFetch: number;
    private maxConcurrentFetches: number;
    private parser: LogParser;
    private startBlock: number;
    private nfts : Array<Address>;
    private name: string;
    constructor(name : string, startBlock: number, provider : JsonRpcProvider, batchSizePerFetch : number , maxConcurrentFetches: number, parser: LogParser, nfts : Array<Address>) {
        this.name = name
        this.provider = provider
        this.batchSizePerFetch = batchSizePerFetch;
        this.maxConcurrentFetches = maxConcurrentFetches;
        this.parser = parser;
        this.startBlock = startBlock;
        this.nfts = nfts;
    }

    async getLatestBlockNumber() {
        return await exponentialBackoffRetry(() => this.provider.getBlockNumber());
    }

    async fetchLogs(startBlock : number, endBlock : number, retries: number = 6) : Promise<Array<Log>> {
        for (let i = 0; i < retries; i++) {
            try {
                return await this.provider.getLogs({
                    fromBlock: startBlock,
                    toBlock: endBlock,
                    address: [WARM_XYZ_CONTRACT, DELEGATE_V1_CONTRACT, DELEGATE_V2_CONTRACT, METADATA_EXTENSION_CONTRACT, ...this.nfts],
                    topics: [[ERC721_TRANSFER_TOPIC,
                        WARM_WALLET_TOPIC,
                        DELEGATE_V1_DELEGATE_ALL, DELEGATE_v1_DELEGATE_CONTRACT, DELEGATE_V1_DELEGATE_TOKEN,
                        DELEGATE_V2_DELEGATE_ALL, DELEGATE_V2_DELEGATE_CONTRACT, DELEGATE_V2_DELEGATE_ERC721,
                        METADATA_EXTENSION_SET
                    ]]
                });
            } catch (error) {
                if(error.error && error.error.message && error.error.message.indexOf("query returned more than") !== -1) {
                    console.log(`${this.name} query from ${startBlock} to ${endBlock} returned more than 10000 logs, splitting into smaller queries`)
                    let middleBlock = Math.floor((endBlock - startBlock) / 2) + startBlock;
                    let logs = await Promise.all([this.fetchLogs(startBlock, middleBlock), this.fetchLogs(middleBlock + 1, endBlock)]);
                    return logs.flat();
                }

                if (i === retries - 1) throw error; // If it's the last retry, throw the error
                await new Promise(resolve => setTimeout(resolve, 1000 * Math.pow(2, i))); // Exponential backoff
            }
        }
    }

    async run() {
        let latestBlock = await this.getLatestBlockNumber();
        let nextBlockToRead = this.startBlock;

        while(true) {
            let batchSizePerFetch = this.batchSizePerFetch;
            while (nextBlockToRead < latestBlock) {
                let promises : Array<Promise<Array<Log>>> = []
                for (let i = 0; i < this.maxConcurrentFetches; i++) {
                    let endBlock = Math.min(nextBlockToRead + batchSizePerFetch, latestBlock);
                    if (nextBlockToRead < endBlock) {
                        promises.push(this.fetchLogs(nextBlockToRead, endBlock));
                        nextBlockToRead = endBlock + 1; // increment currentBlock by one as fetching is inclusive of latestBlock
                    }
                }
                let logs = (await Promise.all(promises)).flat();
                if(logs.length > 0) {
                    console.log(`${this.name} fetched ${logs.length} logs, nextBlockToRead: ${nextBlockToRead} latestBlock: ${latestBlock}`);
                }
                this.parser.processLogs(logs, nextBlockToRead - 1);
            }

            await new Promise(resolve => setTimeout(resolve, 5000));
            latestBlock = await this.getLatestBlockNumber();
        }
    }
}