import hardhat from "hardhat";
const { ethers, network, run } = hardhat;
import { createRequire } from "module";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const require = createRequire(import.meta.url);

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log("====================================================");
  console.log(`Deploying contracts with account: ${deployer.address}`);
  console.log(`Account balance: ${(await ethers.provider.getBalance(deployer.address)).toString()} wei`);
  console.log(`Network: ${network.name}`);
  console.log("====================================================");

  // 1. Deploy Token contract
  console.log("Deploying YourToken...");
  const Token = await ethers.getContractFactory("YourToken");
  const token = await Token.deploy("FaucetToken", "FTK", deployer.address);
  await token.waitForDeployment();
  const tokenAddress = await token.getAddress();
  console.log(`YourToken deployed to: ${tokenAddress}`);

  // 2. Deploy TokenFaucet contract
  console.log("Deploying TokenFaucet...");
  const Faucet = await ethers.getContractFactory("TokenFaucet");
  const faucet = await Faucet.deploy(tokenAddress);
  await faucet.waitForDeployment();
  const faucetAddress = await faucet.getAddress();
  console.log(`TokenFaucet deployed to: ${faucetAddress}`);

  // 3. Grant minting role to faucet in token contract
  console.log("Setting Faucet as minter in Token contract...");
  const setMinterTx = await token.setMinter(faucetAddress);
  await setMinterTx.wait();
  console.log("Minter set successfully!");

  // 4. Save contract addresses and ABIs for the frontend
  const frontendDir = path.join(__dirname, "..", "frontend", "src", "utils");
  if (!fs.existsSync(frontendDir)) {
    fs.mkdirSync(frontendDir, { recursive: true });
  }

  const tokenArtifact = require("../artifacts/contracts/Token.sol/YourToken.json");
  const faucetArtifact = require("../artifacts/contracts/TokenFaucet.sol/TokenFaucet.json");

  const contractData = {
    tokenAddress,
    faucetAddress,
    tokenAbi: tokenArtifact.abi,
    faucetAbi: faucetArtifact.abi,
    network: network.name,
    chainId: network.config.chainId,
  };

  fs.writeFileSync(
    path.join(frontendDir, "contractsData.json"),
    JSON.stringify(contractData, null, 2)
  );
  console.log(`Contract data exported to: ${path.join(frontendDir, "contractsData.json")}`);

  // 5. Verify contracts on Etherscan if not on a local network
  if (network.name !== "hardhat" && network.name !== "localhost") {
    console.log("====================================================");
    console.log("Waiting for block confirmations before verification...");
    await token.deploymentTransaction().wait(5);

    console.log("Verifying YourToken on Etherscan...");
    try {
      await run("verify:verify", {
        address: tokenAddress,
        constructorArguments: ["FaucetToken", "FTK", deployer.address],
      });
    } catch (e) {
      console.log(`Token verification failed: ${e.message}`);
    }

    console.log("Verifying TokenFaucet on Etherscan...");
    try {
      await run("verify:verify", {
        address: faucetAddress,
        constructorArguments: [tokenAddress],
      });
    } catch (e) {
      console.log(`Faucet verification failed: ${e.message}`);
    }
  }

  console.log("====================================================");
  console.log("Deployment and configuration completed successfully!");
  console.log(`Token Address:  ${tokenAddress}`);
  console.log(`Faucet Address: ${faucetAddress}`);
  console.log("====================================================");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
