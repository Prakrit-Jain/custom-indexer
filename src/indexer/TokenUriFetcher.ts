import {AsyncQueue} from "./AsyncQueue";
import {Address, ChainId, ProtocolIndex, TokenId} from "./ProtocolIndex";
import {ethers, JsonRpcProvider} from "ethers";

const ERC721_ABI = [
    "function tokenURI(uint256 tokenId) external view returns (string)",
    "function supportsInterface(bytes4 interfaceId) external view returns (bool)"
];

const ERC721_METADATA_INTERFACE_ID = "0x5b5e139f";

const BULK_CONTRACT_ADDRESSES = {
    "1" : "0x2Beb458aB2cE5b4002b45a9a0A4c13f38dD2152e",
    "137" : "0x89ae18B0c08447be094373c33BEe131110F7e6C8",
    "11155111" : "0x93365Bda8f3766a2882a9Ab06FbfAa4E4c005C38"
}

const BULK_QUERY_ABI = [
    {
        "inputs": [
            {
                "internalType": "address[]",
                "name": "contractAddresses",
                "type": "address[]"
            },
            {
                "internalType": "uint256[]",
                "name": "tokenIds",
                "type": "uint256[]"
            }
        ],
        "name": "bulkQuery",
        "outputs": [
            {
                "internalType": "string[]",
                "name": "",
                "type": "string[]"
            }
        ],
        "stateMutability": "view",
        "type": "function"
    }
];

export class TokenUriFetcher {
    private requestQueue: AsyncQueue;
    private chainId: ChainId;
    private provider: ethers.JsonRpcProvider;
    private tokensToFetch: Array<{contract: Address, tokenId: TokenId}>;
    private ownershipIndex: ProtocolIndex;
    private batchInterval : number;
    private name: string;
    private bulkQueryContract: ethers.Contract;

    constructor(name: string, provider: JsonRpcProvider, chainId: ChainId, ownershipIndex: ProtocolIndex, queue: AsyncQueue, batchInterval: number = 3000) {
        this.name = name;
        this.requestQueue = queue;
        this.chainId = chainId;
        this.provider = provider
        this.ownershipIndex = ownershipIndex;
        this.tokensToFetch = [];
        this.batchInterval = batchInterval;
        this.bulkQueryContract = new ethers.Contract(BULK_CONTRACT_ADDRESSES[chainId], BULK_QUERY_ABI, provider);
    }

    async supportsErc721Metadata(contract: Address, retries: number = 3): Promise<boolean> {
        const contractInstance = new ethers.Contract(contract, ERC721_ABI, this.provider);
        for (let i = 0; i < retries; i++) {
            try {
                return await contractInstance.supportsInterface(ERC721_METADATA_INTERFACE_ID);
            } catch (error) {
                if (i === retries - 1) throw error;
            }
        }
        return false;
    }

    async fetchUri(contract: Address, tokenId: TokenId, retries: number = 3): Promise<string> {
        const results = await this.bulkQueryContract.bulkQuery([contract], [tokenId]);
        if(results.length === 0) {
            return "";
        }
        return results[0];
    }

    async run() {
        this.enqueueBatchesToFetch();

        while (true) {
            // sleep 5 seconds
            await new Promise(resolve => setTimeout(resolve, this.batchInterval));
            if (this.tokensToFetch.length === 0) {
                continue;
            }

            let tokensToFetchThisBatch = [...this.tokensToFetch];
            this.tokensToFetch = [];

            let promises = [];

            let currentBatchContracts = [];
            let currentBatchTokenIds = [];

            for (let i = 0; i < tokensToFetchThisBatch.length; i++) {
                if(currentBatchContracts.length === 100) {
                    promises.push(this.bulkQueryContract.bulkQuery(currentBatchContracts, currentBatchTokenIds));
                    currentBatchContracts = [];
                    currentBatchTokenIds = [];
                }
                const {contract, tokenId} = tokensToFetchThisBatch[i];
                currentBatchContracts.push(contract);
                currentBatchTokenIds.push(tokenId);
            }
            promises.push(this.bulkQueryContract.bulkQuery(currentBatchContracts, currentBatchTokenIds));

            const results = await Promise.all(promises);
            let uris = [];
            for (let i = 0; i < results.length; i++) {
                uris = uris.concat(results[i]);
            }

            for (let i = 0; i < uris.length; i++) {
                const uri = uris[i] !== null ? uris[i] : "";
                this.ownershipIndex.setTokenUri(this.chainId, tokensToFetchThisBatch[i].contract, tokensToFetchThisBatch[i].tokenId, uri);
            }
            if(uris.length > 0) {
                console.log(`${this.name} fetched ${tokensToFetchThisBatch.length} token URIs`)
            }
        }
    }

    async enqueueBatchesToFetch() {
        while (true) {
            if(this.tokensToFetch.length < 500 * 80) {
                // @ts-ignore
                const {contract, tokenId} = await this.requestQueue.dequeue();
                this.tokensToFetch.push({contract, tokenId});
            }
            else {
                // wait
                await new Promise(resolve => setTimeout(resolve, 100));
            }
        }
    }
}
