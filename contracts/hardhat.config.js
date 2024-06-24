require("@nomicfoundation/hardhat-toolbox");

/** @type import('hardhat/config').HardhatUserConfig */
module.exports = {
  solidity: "0.8.20",
  compilerVersion: "0.8.20",
  defaultNetwork: "hardhat",
  sourcify: {
    enabled: true
  },
  networks: {
    mainnet : {
      url: "https://mainnet.infura.io/v3/56dcd43823d34252a3bf61d18c5005ba",
      accounts: [process.env.PRIVATE_KEY]
    },
    matic: {
      url: "https://polygon-mainnet.infura.io/v3/56dcd43823d34252a3bf61d18c5005ba",
      accounts: [process.env.PRIVATE_KEY]
    },
    sepolia: {
      url: "https://sepolia.infura.io/v3/56dcd43823d34252a3bf61d18c5005ba",
      accounts: [process.env.PRIVATE_KEY]
    },
  }
};


