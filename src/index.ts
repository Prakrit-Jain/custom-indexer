import {IndexerNode} from "./indexer/IndexerNode";
import {FanoutNode} from "./fanout/FanoutNode";

const port = parseInt(process.env.PORT) || 8080
const role = process.env.ROLE || "indexer"
const prefix = process.env.DATABASE_PREFIX || ""

const version = require("../package.json").version

console.log("Version:", version)
console.log("Role:", role)

// ETH
const BAYC_CONTRACT = "0xbc4ca0eda7647a8ab7c2061c2e118a18a936f13d"
const RUNES_CONTRACT = "0x521f9c7505005cfa19a8e5786a9c3c9c9f5e6f42"
const GRILLZ_CONTRACT = "0xbd9071b63f25dd199079ed80b3b384d78042956b"
const OTHERDEEDS_CONTRACT = "0x34d85c9cdeb23fa97cb08333b511ac86e1c4e258"
const MAYC_CONTRACT = "0x60e4d786628fea6478f785a6d7e704777c86a7c6"

// MATIC
const CYLINDER_FOLK_CONTRACT = "0x1a883fd780d0b377ee51cf17c5ea395bfff85ac5"
const GOLDEN_BLOB_CONTRACT = "0xbd62f9c953c51251cb7cdfdbc959063e49815916"
const META_NFT_CONTRACT = "0xd0f9f556d5d470fcb6ead8c0d89122c504df19eb"

// SEPOLIA
const SOMNIA_AVATAR_CONTRACT = "0xfdadf685109db043ad0a811c1afc43ec1e060b7a"


if(role === "indexer") {
    const indexerServer = new IndexerNode([
        {
            name: "Ethereum",
            providerUrl: "https://mainnet.infura.io/v3/56dcd43823d34252a3bf61d18c5005ba",
            chainId: "1",
            startBlock: 12000000,
            batchSizePerFetch: 5000,
            maxConcurrentFetches: 50,
            nfts: [BAYC_CONTRACT, RUNES_CONTRACT, GRILLZ_CONTRACT, OTHERDEEDS_CONTRACT, MAYC_CONTRACT]
        },
        {
            name: "Polygon",
            providerUrl: "https://polygon-mainnet.infura.io/v3/56dcd43823d34252a3bf61d18c5005ba",
            chainId: "137",
            startBlock: 40449800,
            batchSizePerFetch: 5000,
            maxConcurrentFetches: 50,
            nfts: [CYLINDER_FOLK_CONTRACT, GOLDEN_BLOB_CONTRACT, META_NFT_CONTRACT]
        },
        {
            name : "Sepolia",
            providerUrl: "https://sepolia.infura.io/v3/56dcd43823d34252a3bf61d18c5005ba",
            chainId: "11155111",
            startBlock: 5680000,
            batchSizePerFetch: 5000,
            maxConcurrentFetches: 50,
            nfts: [SOMNIA_AVATAR_CONTRACT]
        }
    ], 10000, prefix)

    indexerServer.start(port)
}

if(role === "fanout") {
    const fanoutServer = new FanoutNode(prefix);
    fanoutServer.start(port)
}


