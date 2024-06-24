import {createClient} from "redis";

const redisPassword = process.env.REDIS_PASSWORD
const redisHost = process.env.REDIS_HOST
const redisPort = parseInt(process.env.REDIS_PORT) || 19508

// used for lower priority metadata fetching (periodic updates)
export const REDIS_METADATA_QUEUE = "metadataQueue"

// used for higher priority metadata fetching (eg - initial updates for a new token)
export const REDIS_METADATA_PRIORITY_QUEUE = "metadataPriorityQueue"

// stores all uris that are known to the indexer
export const REDIS_ALL_URI_SET = "allUriSet"

export const redisClient = createClient({
    password: redisPassword,
    socket: {
        host: redisHost,
        port: redisPort
    }
});

redisClient.connect()

export const redisSubscribeClient = createClient({
    password: redisPassword,
    socket: {
        host: redisHost,
        port: redisPort
    }
});
redisSubscribeClient.connect()
