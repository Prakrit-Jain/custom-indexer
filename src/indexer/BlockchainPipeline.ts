import {AsyncQueue} from "./AsyncQueue";
import {ChainId, ProtocolIndex} from "./ProtocolIndex";
import {DelegationIndex} from "./DelegationIndex";
import {LogFetcher} from "./LogFetcher";
import {LogParser} from "./LogParser";
import {TokenUriFetcher} from "./TokenUriFetcher";
import {JsonRpcProvider} from "ethers";

export type EvmIndexerConfig = {
    name: string,
    providerUrl: string,
    chainId : ChainId,
    startBlock: number,
    batchSizePerFetch: number,
    maxConcurrentFetches: number,
    nfts: Array<string>
}
export class BlockchainPipeline {
    private processorQueue: AsyncQueue;
    private uriQueue: AsyncQueue;

    private ownershipIndex: ProtocolIndex;
    private delegationIndex: DelegationIndex;
    private config: EvmIndexerConfig;
    private logFetcher : LogFetcher;
    private processor : LogParser;
    private tokenUriFetcher: TokenUriFetcher;
    private provider : JsonRpcProvider

    constructor(config: EvmIndexerConfig, ownershipIndex: ProtocolIndex, delegationIndex: DelegationIndex) {
        this.processorQueue = new AsyncQueue();
        this.uriQueue = new AsyncQueue();
        this.ownershipIndex = ownershipIndex;
        this.delegationIndex = delegationIndex;
        this.config = config;
        this.provider = new JsonRpcProvider(config.providerUrl);

        this.processor = new LogParser(this.uriQueue, config.chainId, this.delegationIndex, this.ownershipIndex);
        this.logFetcher = new LogFetcher(config.name, config.startBlock, this.provider, config.batchSizePerFetch, config.maxConcurrentFetches, this.processor, config.nfts);
        this.tokenUriFetcher = new TokenUriFetcher(config.name, this.provider, config.chainId, this.ownershipIndex, this.uriQueue);
    }
    async run() {
        this.logFetcher.run();
        this.tokenUriFetcher.run();
    }
}