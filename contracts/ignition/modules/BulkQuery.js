const { buildModule } = require("@nomicfoundation/hardhat-ignition/modules");

module.exports = buildModule("BulkQueryModule", (m) => {
  const bulkQuery = m.contract("ERC721BulkQuery", [], {});
  return { bulkQuery };
});
