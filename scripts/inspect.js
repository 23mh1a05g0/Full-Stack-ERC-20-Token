import hre from 'hardhat';
const conn = await hre.network.connect();
console.log('ethers on conn?', typeof conn.ethers);
if (conn.ethers) {
  const signers = await conn.ethers.getSigners();
  console.log('First signer:', signers[0].address);
}
