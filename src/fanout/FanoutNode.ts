import express from 'express';
import compression from 'compression';
import cors from 'cors';
import {redisClient, redisSubscribeClient} from "../redisUtil";
import {WebSocketServer} from "ws";
import {TokenRef} from "../indexer/ProtocolIndex";

export class FanoutNode {
    private app: any;
    private wss: WebSocketServer;
    private activeConnections: [string, any][]
    private prefix: string;

    async getTokenMetadata(tokenRef: TokenRef) {
        const tokenInfoString = await redisClient.get(this.prefix + tokenRef);
        if (tokenInfoString) {
            const tokenInfo = JSON.parse(tokenInfoString);
            if(tokenInfo.uri) {
                const tokenMetadataString = await redisClient.get(this.prefix + tokenInfo.uri);

                let metadata = {};

                if (tokenMetadataString) {
                    metadata = JSON.parse(tokenMetadataString);
                }

                // attempt to patch in extensions
                for(const extension of tokenInfo.metadataExtensions) {
                    const extensionString = await redisClient.get(this.prefix + extension);
                    if(extensionString) {
                        const extensionData = JSON.parse(extensionString);
                        Object.assign(metadata, extensionData);
                    }
                }

                return metadata;
            }
        } else {
            return {};
        }
    }

    constructor(prefix: string) {
        this.prefix = prefix;
        this.app = express();
        this.app.use(cors());
        this.app.use(compression());
        this.app.get('/balance/:id', async function (req, res, next) {
            res.json(JSON.parse(await redisClient.get(prefix + req.params.id.toLowerCase())))
        });

        this.app.get('/balance-metadata/:id', async (req, res, next) => {
            const balanceString = await redisClient.get(prefix + req.params.id.toLowerCase());
            if(balanceString) {
                const balance = JSON.parse(balanceString);
                let undelegatedPromises = []
                let delegatedPromises = []
                for (const tokenRef of balance.undelegatedTokens) {
                    undelegatedPromises.push(this.getTokenMetadata(tokenRef));
                }
                for(const tokenRef of balance.delegatedTokens) {
                    delegatedPromises.push(this.getTokenMetadata(tokenRef));
                }
                const delegatedMetdata = await Promise.all(delegatedPromises);
                const undelegatedMetadata = await Promise.all(undelegatedPromises);

                let result = {
                    delegatedTokens: [],
                    undelegatedTokens: []
                }

                for(let i = 0; i < balance.undelegatedTokens.length; i++) {
                    const token = balance.undelegatedTokens[i];
                    const metadata = undelegatedMetadata[i];
                    result.undelegatedTokens.push({token, metadata});
                }

                for(let i = 0; i < balance.delegatedTokens.length; i++) {
                    const token = balance.delegatedTokens[i];
                    const metadata = delegatedMetdata[i];
                    result.delegatedTokens.push({token, metadata});
                }

                res.json(result);

            } else {
                res.json({})
            }
        });

        this.app.get('/token/:id', async function (req, res, next) {
            res.json(JSON.parse(await redisClient.get(prefix + req.params.id.toLowerCase())))
        });

        this.app.get('/token-metadata/:id', async (req, res, next) => {
            res.json(await this.getTokenMetadata(req.params.id));
        });

        this.app.get('/contract/:id', async function (req, res, next) {
            res.json(JSON.parse(await redisClient.get(prefix + req.params.id.toLowerCase())))
        });

        this.app.get('/contract-metadata/:id', async (req, res, next) => {
            const contractMetadataString = await redisClient.get(prefix + req.params.id.toLowerCase());
            if(contractMetadataString) {
                const contractMetadata = JSON.parse(contractMetadataString);
                let promises = []
                for (const tokenRef of contractMetadata.tokens) {
                    promises.push(this.getTokenMetadata(tokenRef));
                }
                const tokenMetadata = await Promise.all(promises);
                res.json(tokenMetadata);
            } else {
                res.json({})
            }
        });

        this.app.get('/metadata/:id', async function (req, res, next) {
            res.json(JSON.parse(await redisClient.get(prefix + req.params.id.toLowerCase())))
        });

        this.wss = new WebSocketServer({noServer: true});

        this.activeConnections = [];
    }

    async start(port: number) {
        const server = this.app.listen(port, function () {
            console.log('Fanout server listening on port ' + port);
        });
        server.on('upgrade', (request, socket, head) => {
            this.wss.handleUpgrade(request, socket, head, (ws) => {
                this.wss.emit('connection', ws, request);
            });
        });
        this.wss.on('connection', async (ws, req) => {
            const wallet = req.url?.split('/').pop();

            if (wallet) {
                this.activeConnections.push([wallet, ws]);
                console.log(`New connection for wallet ${wallet}`)
                if (wallet !== '*') {
                    let fetchedBalance = await redisClient.get(this.prefix + wallet)
                    ws.send(fetchedBalance);
                }
                ws.on('close', () => {
                    this.activeConnections = this.activeConnections.filter(([_, socket]) => socket !== ws);
                    console.log(`Connection closed for wallet ${wallet}`)
                });
            }
        });

        console.log('Subscribing to walletBalanceChanged topic');
        redisSubscribeClient.subscribe(this.prefix + "walletBalanceChanged", async (message, topic) => {
            if (topic === this.prefix + 'walletBalanceChanged') {
                const wallet = message.toLowerCase();
                let socketsToSendTo = []
                for (const [address, ws] of this.activeConnections) {
                    if (address === wallet || address === '*') {
                        socketsToSendTo.push(ws)
                    }
                }
                if (socketsToSendTo.length > 0) {
                    let fetchedBalance = await redisClient.get(this.prefix + wallet)
                    socketsToSendTo.forEach((ws) => {
                        ws.send(`{ "wallet": "${wallet}", "balance": ${fetchedBalance} }`);
                    });
                }
            }
        });
    }
}