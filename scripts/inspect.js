import hre from 'hardhat';
const conn = await hre.network.getOrCreate();
if (conn.verification && conn.verification.etherscan) {
  console.log('etherscan proto names:', Object.getOwnPropertyNames(Object.getPrototypeOf(conn.verification.etherscan)));
}
