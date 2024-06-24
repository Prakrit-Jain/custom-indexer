// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

contract ERC721MetadataExtension {
    // Event to notify that metadata extension has been set
    // URI is of the form "https://address.com/{id}.json", where
    // {id} is the token ID to be substituted in
    event MetadataExtensionSet(address contractAddress, string uri);

    // Mapping from ERC721 contract address to extended metadata URI
    mapping(address => string) private _extendedURIs;

    address owner;

    constructor() {
        owner = msg.sender;
    }

    modifier onlyOwner() {
        require(msg.sender == owner, "Only owner can call this function");
        _;
    }

    // Function to set the extended metadata URI for an ERC721 contract
    function setMetadataExtension(address contractAddress, string memory uri) external onlyOwner {
        require(contractAddress != address(0), "Invalid contract address");
        require(bytes(uri).length > 0, "URI cannot be empty");

        _extendedURIs[contractAddress] = uri;
        emit MetadataExtensionSet(contractAddress, uri);
    }

    // Function to get the extended metadata URI for an ERC721 contract
    function getMetadataExtension(address contractAddress) external view returns (string memory) {
        return _extendedURIs[contractAddress];
    }
}
