import express from "express";
import cors from "cors";
import {BlockchainPipeline, EvmIndexerConfig} from "./BlockchainPipeline";
import {ProtocolIndex} from "./ProtocolIndex";
import {DelegationIndex} from "./DelegationIndex";
import {redisClient, redisSubscribeClient} from "../redisUtil";
import {WebSocketServer} from "ws";

export class IndexerNode {
    private app: any;
    private indexers: Array<BlockchainPipeline>;
    private ownershipIndex: ProtocolIndex;
    private prefix: string;
    private delegationIndex: DelegationIndex;
    private flushInterval: number;

    constructor(configs: Array<EvmIndexerConfig>, flushInterval: number, prefix: string) {
        this.prefix = prefix;
        this.app = express();
        this.app.use(cors());
        this.app.get('/', async function (req, res, next) {
            res.json({status: "ok"});
        });

        this.delegationIndex = new DelegationIndex();
        this.ownershipIndex = new ProtocolIndex(this.delegationIndex);
        this.flushInterval = flushInterval;

        this.indexers = configs.map((config) => {
            return new BlockchainPipeline(config, this.ownershipIndex, this.delegationIndex);
        });
    }

    async start(port) {
        this.indexers.forEach((indexer) => {
            indexer.run();
        });

        this.app.listen(port, function () {
            console.log('Indexer server listening on port ' + port);
        });

        let requestedTokenUris = new Set<string>()

        while (true) {
            await new Promise(resolve => setTimeout(resolve, this.flushInterval));


            const shouldFlush = await this.isIndexerAheadOfRedisCache();
            if(!shouldFlush) {
                console.log("Indexer is behind Redis cache, skipping flush")
                continue;
            }

            // Flush wallet stuff to redis
            const dirtyWallets = this.ownershipIndex.flushDirtyWallets();
            dirtyWallets.forEach((wallet) => {
                const balance = this.ownershipIndex.getWallet(wallet);
                redisClient.set(this.prefix + wallet, JSON.stringify(balance));
                redisClient.publish(this.prefix + "walletBalanceChanged", wallet);
            });
            if (dirtyWallets.length > 0) {
                console.log("Flushed " + dirtyWallets.length + " wallets")
            }

            // Flush token stuff to redis
            const dirtyTokens = this.ownershipIndex.flushDirtyTokens();
            dirtyTokens.forEach((tokenRef) => {
                const token = this.ownershipIndex.getToken(tokenRef);

                if(token.uri && !requestedTokenUris.has(token.uri)) {
                    requestedTokenUris.add(token.uri)
                    redisClient.rPush(this.prefix + "tokenUriRequests", token.uri)
                }

                token.metadataExtensions.filter(uri => !requestedTokenUris.has(uri)).forEach((metadataExtension) => {
                    requestedTokenUris.add(metadataExtension)
                    redisClient.rPush(this.prefix + "tokenUriRequests", metadataExtension)
                });

                redisClient.set(this.prefix + tokenRef, JSON.stringify(token));
            });
            if (dirtyTokens.length > 0) {
                console.log("Flushed " + dirtyTokens.length + " tokens")
            }

            // Flush contract stuff to redis
            const dirtyContracts = this.ownershipIndex.flushDirtyContracts();
            dirtyContracts.forEach((contractRef) => {
                const contract = this.ownershipIndex.getContract(contractRef);
                redisClient.set(this.prefix + contractRef, JSON.stringify(contract));
            });
            if (dirtyContracts.length > 0) {
                console.log("Flushed " + dirtyContracts.length + " contracts")
            }

            await this.updateRedisCacheBlockState();
        }
    }

    private async isIndexerAheadOfRedisCache() : Promise<boolean> {
        const latestBlockString = await redisClient.get(this.prefix + "latestBlocks");
        if(latestBlockString) {
            const latestCachedBlocks = JSON.parse(latestBlockString);
            const latestLocalBlocks = this.ownershipIndex.getLatestBlocks()
            let result = true;
            for(const chainId in latestCachedBlocks) {
                if(!latestLocalBlocks[chainId]) {
                    console.log("Local block for ChainId " + chainId + " is not present");
                    result = false;
                }
                else if(latestLocalBlocks[chainId] < latestCachedBlocks[chainId]) {
                    console.log("Local block for ChainId " + chainId + " (" + latestLocalBlocks[chainId] + ") is behind cached block (" + latestCachedBlocks[chainId] + ")");
                    result = false;
                }
            }
            return result;
        }
        else {
            return true;
        }
    }

    private async updateRedisCacheBlockState() {
        const latestBlocks = this.ownershipIndex.getLatestBlocks()
        await redisClient.set(this.prefix + "latestBlocks", JSON.stringify(latestBlocks));
    }
}