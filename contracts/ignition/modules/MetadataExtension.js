const { buildModule } = require("@nomicfoundation/hardhat-ignition/modules");

module.exports = buildModule("MetadataExtension", (m) => {
  const metadataExtension = m.contract("ERC721MetadataExtension", [], {});
  return { metadataExtension };
});
