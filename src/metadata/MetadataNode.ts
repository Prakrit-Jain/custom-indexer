import express from 'express';
import {redisClient} from "../redisUtil";
import {ProxyFetcher} from "./ProxyFetcher";
import {AsyncQueue} from "../indexer/AsyncQueue";

export class MetadataNode {
    private app: any;
    private prefix: string;
    private retryAttempts: number;
    private proxyFetcher: ProxyFetcher;

    private metadatasFetchedThisIncrement: number = 0;
    private metadatasSkippedThisIncrement: number = 0;

    private queue;


    constructor(prefix: string, retryAttempts = 3) {
        this.prefix = prefix;
        this.app = express();
        this.retryAttempts = retryAttempts;
        this.proxyFetcher = new ProxyFetcher();
        this.queue = new AsyncQueue();
    }

    async start(port: number) {
        const server = this.app.listen(port, function () {
            console.log('Metadata server listening on port ' + port);
        });

        let lastUpdated = Date.now();

        // start 50 metadata fetchers
        for (let i = 0; i < 50; i++) {
            this.runMetadataFetcher();
        }

        while (true) {
            if(this.queue.size < 50) {
                const batch = await redisClient.lPopCount(this.prefix + "tokenUriRequests", 100);
                if(batch) {
                    for (let uri of batch) {
                        this.queue.enqueue(uri);
                    }
                }
            }
            else {
                await new Promise(resolve => setTimeout(resolve, 100));
            }

            if (Date.now() - lastUpdated > 60000) {
                console.log(`Fetched ${this.metadatasFetchedThisIncrement} metadata records, skipped ${this.metadatasSkippedThisIncrement} records`);
                this.metadatasFetchedThisIncrement = 0;
                this.metadatasSkippedThisIncrement = 0;
                lastUpdated = Date.now();
            }
        }
    }

    async runMetadataFetcher() {
        while (true) {
            const uri = await this.queue.dequeue();
            if(uri) {
                const fetched = await this.fetchMetadata(uri);
                if(fetched) {
                    this.metadatasFetchedThisIncrement++;
                }
                else {
                    this.metadatasSkippedThisIncrement++;
                }
            }
        }
    }

    async fetchMetadata(uri: string): Promise<boolean> {
        try {
            // check if uri has already been fetched
            const currentMetadata = await redisClient.get(this.prefix + uri)
            if (currentMetadata) {
                // console.log(`Skipping metadata for ${uri}`);
                return false;
            }

            // modify uri to use infura proxy if IPFS
            const modifiedUri = uri.replace("ipfs://", "https://mml.infura-ipfs.io/ipfs/");

            const metadata =  await this.proxyFetcher.fetch(modifiedUri, this.retryAttempts);
            if(metadata) {
                await redisClient.set(this.prefix + uri, JSON.stringify(metadata));
            }
            // console.log(`Got metadata for ${uri}`);
            return true;
        } catch (error) {
            console.error(`Failed to fetch metadata for ${uri}:`, error);
            return null;
        }
    }
}
