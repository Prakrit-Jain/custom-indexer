import {ethers, Log} from "ethers";
import {
    DELEGATE_V1_CONTRACT,
    DELEGATE_V1_DELEGATE_ALL,
    DELEGATE_v1_DELEGATE_CONTRACT,
    DELEGATE_V1_DELEGATE_TOKEN,
    DELEGATE_V2_CONTRACT,
    DELEGATE_V2_DELEGATE_ALL,
    DELEGATE_V2_DELEGATE_CONTRACT, DELEGATE_V2_DELEGATE_ERC721, METADATA_EXTENSION_CONTRACT, METADATA_EXTENSION_SET,
    WARM_XYZ_CONTRACT
} from "./LogFetcher";
import {ChainId, NULL_ADDRESS, ProtocolIndex} from "./ProtocolIndex";
import {AsyncQueue} from "./AsyncQueue";
import {DelegationIndex} from "./DelegationIndex";

const erc721 = new ethers.Interface(["event Transfer(address indexed from, address indexed to, uint256 indexed tokenId)"]);

// WarmXYZ
const warmInterface = new ethers.Interface(["event HotWalletChanged(address coldWallet, address from, address to, uint256 expirationTimestamp)"]);

// DelegateXYZ V1
const delegateV1DelegateAll = new ethers.Interface(["event DelegateForAll(address vault, address delegate, bool value)"]);
const delegateV1DelegateContract = new ethers.Interface(["event DelegateForContract (address vault, address delegate, address contract_, bool value)"]);
const delegateV1DelegateToken = new ethers.Interface(["event DelegateForToken(address vault, address delegate, address contract_, uint256 tokenId, bool value)"]);

// DelegateXYZ V2
const delegateV2DelegateAll = new ethers.Interface(["event DelegateAll(address indexed from, address indexed to, bytes32 rights, bool enable)"]);
const delegateV2DelegateContract = new ethers.Interface(["event DelegateContract (address indexed from, address indexed to, address indexed contract_, bytes32 rights, bool enable)"]);
const delegateV2DelegateErc721 = new ethers.Interface(["event DelegateERC721(address indexed from, address indexed to, address indexed contract_, uint256 tokenId, bytes32 rights, bool enable)"]);

// Metadata Extension
const metadataExtensionSet = new ethers.Interface(["event MetadataExtensionSet (address contractAddress, string uri)"]);

export class LogParser {
    private uriQueue: AsyncQueue;
    private chainId: ChainId;
    private delegationIndex: DelegationIndex;
    private ownershipIndex: ProtocolIndex;

    constructor(uriQueue: AsyncQueue, chainId: ChainId, delegationIndex: DelegationIndex, ownershipIndex: ProtocolIndex) {
        this.uriQueue = uriQueue;
        this.chainId = chainId;
        this.delegationIndex = delegationIndex;
        this.ownershipIndex = ownershipIndex;
    }

    processLogs(logs: Log[], latestBlock: number) {
        logs.forEach((log) => {
            this.processLog(log);
        });
        this.ownershipIndex.setLatestBlock(this.chainId, latestBlock);
    }

    private processLog(log: Log) {
        if (log.address === WARM_XYZ_CONTRACT) {
            const parsedWarmLog = warmInterface.parseLog(log);
            if (parsedWarmLog !== null) {
                const coldWallet = parsedWarmLog.args.coldWallet.toLowerCase();
                const from = parsedWarmLog.args.from.toLowerCase();
                const to = parsedWarmLog.args.to.toLowerCase();
                const expirationTimestamp = parsedWarmLog.args.expirationTimestamp;

                this.delegationIndex.warmXyzAddDelegation(coldWallet, from, to, this.chainId, expirationTimestamp)
                this.ownershipIndex.updateWalletDelegations(coldWallet)
            }
        } else if (log.address === DELEGATE_V1_CONTRACT) {
            if (log.topics[0] === DELEGATE_V1_DELEGATE_ALL) {
                const parsedDelegateV1Log = delegateV1DelegateAll.parseLog(log);
                if (parsedDelegateV1Log !== null) {
                    const vault = parsedDelegateV1Log.args.vault.toLowerCase();
                    const delegate = parsedDelegateV1Log.args.delegate.toLowerCase();
                    const value = parsedDelegateV1Log.args.value;
                    this.delegationIndex.delegateXyzAllWallet(vault, delegate, this.chainId, value)
                    this.ownershipIndex.updateWalletDelegations(vault)
                }
            } else if (log.topics[0] === DELEGATE_v1_DELEGATE_CONTRACT) {
                const parsedDelegateV1Log = delegateV1DelegateContract.parseLog(log);
                if (parsedDelegateV1Log !== null) {
                    const vault = parsedDelegateV1Log.args.vault.toLowerCase();
                    const delegate = parsedDelegateV1Log.args.delegate.toLowerCase();
                    const contract = parsedDelegateV1Log.args.contract_.toLowerCase();
                    const value = parsedDelegateV1Log.args.value;
                    this.delegationIndex.delegateXyzContract(vault, delegate, this.chainId, contract, value)
                    this.ownershipIndex.updateWalletDelegations(vault)
                }
            } else if (log.topics[0] === DELEGATE_V1_DELEGATE_TOKEN) {
                const parsedDelegateV1Log = delegateV1DelegateToken.parseLog(log);
                if (parsedDelegateV1Log !== null) {
                    const vault = parsedDelegateV1Log.args.vault.toLowerCase();
                    const delegate = parsedDelegateV1Log.args.delegate.toLowerCase();
                    const contract = parsedDelegateV1Log.args.contract_.toLowerCase();
                    const tokenId = parsedDelegateV1Log.args.tokenId;
                    const value = parsedDelegateV1Log.args.value;
                    this.delegationIndex.delegateXyzToken(vault, delegate, this.chainId, contract, tokenId, value)
                    this.ownershipIndex.updateWalletDelegations(vault)
                }
            }
        } else if (log.address === DELEGATE_V2_CONTRACT) {
            if (log.topics[0] === DELEGATE_V2_DELEGATE_ALL) {
                const parsedDelegateV2Log = delegateV2DelegateAll.parseLog(log);
                if (parsedDelegateV2Log !== null) {
                    const from = parsedDelegateV2Log.args.from.toLowerCase();
                    const to = parsedDelegateV2Log.args.to.toLowerCase();
                    const enable = parsedDelegateV2Log.args.enable;
                    this.delegationIndex.delegateXyzAllWallet(from, to, this.chainId, enable)
                    this.ownershipIndex.updateWalletDelegations(from)
                }
            } else if (log.topics[0] === DELEGATE_V2_DELEGATE_CONTRACT) {
                const parsedDelegateV2Log = delegateV2DelegateContract.parseLog(log);
                if (parsedDelegateV2Log !== null) {
                    const from = parsedDelegateV2Log.args.from.toLowerCase();
                    const to = parsedDelegateV2Log.args.to.toLowerCase();
                    const contract = parsedDelegateV2Log.args.contract_.toLowerCase();
                    const enable = parsedDelegateV2Log.args.enable;
                    this.delegationIndex.delegateXyzContract(from, to, this.chainId, contract, enable)
                    this.ownershipIndex.updateWalletDelegations(from)
                }
            } else if (log.topics[0] === DELEGATE_V2_DELEGATE_ERC721) {
                const parsedDelegateV2Log = delegateV2DelegateErc721.parseLog(log);
                if (parsedDelegateV2Log !== null) {
                    const from = parsedDelegateV2Log.args.from.toLowerCase();
                    const to = parsedDelegateV2Log.args.to.toLowerCase();
                    const contract = parsedDelegateV2Log.args.contract_.toLowerCase();
                    const tokenId = parsedDelegateV2Log.args.tokenId;
                    const enable = parsedDelegateV2Log.args.enable;
                    this.delegationIndex.delegateXyzToken(from, to, this.chainId, contract, tokenId, enable)
                    this.ownershipIndex.updateWalletDelegations(from)
                }
            }
        } else if (log.address === METADATA_EXTENSION_CONTRACT) {
            if (log.topics[0] === METADATA_EXTENSION_SET) {
                const parsedMetadataExtension = metadataExtensionSet.parseLog(log);
                if (parsedMetadataExtension !== null) {
                    const contract = parsedMetadataExtension.args.contractAddress.toLowerCase();
                    const uri = parsedMetadataExtension.args.uri;
                    console.log(`Found extension metadata for ${contract} : ${uri}`)
                    this.ownershipIndex.addMetadataExtension(this.chainId, contract, uri);
                }
            }
        } else {
            const parsedErc721Log = erc721.parseLog(log);
            if (parsedErc721Log !== null) {
                const from = parsedErc721Log.args.from.toLowerCase();
                const to = parsedErc721Log.args.to.toLowerCase();
                const tokenId = parsedErc721Log.args.tokenId;
                const contract = log.address.toLowerCase();

                if (!this.ownershipIndex.hasToken(`${this.chainId}:${contract}:${tokenId}`)) {
                    this.uriQueue.enqueue({contract: contract, tokenId: tokenId});
                }
                this.ownershipIndex.transfer(from, to, this.chainId, contract, tokenId);
            }
        }
    }
}
