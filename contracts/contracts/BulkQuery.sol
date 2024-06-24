// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

interface IERC721 {
    function ownerOf(uint256 tokenId) external view returns (address owner);
    function supportsInterface(bytes4 interfaceId) external view returns (bool);
    function tokenURI(uint256 tokenId) external view returns (string memory);
}

contract ERC721BulkQuery {
    bytes4 private constant INTERFACE_ID_ERC721 = 0x80ac58cd;
    bytes4 private constant INTERFACE_ID_ERC721_METADATA = 0x5b5e139f;
    address private constant NULL_ADDRESS = address(0);

    function bulkQuery(address[] calldata contractAddresses, uint256[] calldata tokenIds) external view returns (string[] memory) {
        require(contractAddresses.length == tokenIds.length, "Arrays must have the same length");
        require(contractAddresses.length > 0, "Input arrays cannot be empty");

        string[] memory uris = new string[](contractAddresses.length);

        for (uint256 i = 0; i < contractAddresses.length; i++) {
            bool supportsERC721 = false;
            bool supportsMetadata = false;
            IERC721 erc721 = IERC721(contractAddresses[i]);

            try erc721.supportsInterface(INTERFACE_ID_ERC721) returns (bool result) {
                supportsERC721 = result;
            } catch {
                supportsERC721 = false;
            }

            try erc721.supportsInterface(INTERFACE_ID_ERC721_METADATA) returns (bool result) {
                supportsMetadata = result;
            } catch {
                supportsMetadata = false;
            }

            if (!supportsERC721 || !supportsMetadata) {
                uris[i] = "";
                continue;
            }

            try erc721.tokenURI(tokenIds[i]) returns (string memory uri) {
                uris[i] = uri;
            } catch {
                uris[i] = "";
            }
        }

        return uris;
    }
}
