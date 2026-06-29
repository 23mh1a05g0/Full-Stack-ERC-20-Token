import { expect } from "chai";
import hre from "hardhat";
import { parseEther } from "ethers";

const FAUCET_AMOUNT = parseEther("100");
const MAX_CLAIM_AMOUNT = parseEther("1000");
const COOLDOWN_TIME = 24 * 60 * 60; // 24 hours in seconds

async function getEthers() {
  const conn = await hre.network.getOrCreate();
  return conn.ethers;
}

async function increaseTime(seconds) {
  const conn = await hre.network.getOrCreate();
  await conn.provider.send("evm_increaseTime", [seconds]);
  await conn.provider.send("evm_mine", []);
}

describe("Token and TokenFaucet DApp Tests", function () {
  let ethers;
  let token;
  let faucet;
  let owner;
  let user1;
  let user2;
  let nonAdmin;

  beforeEach(async function () {
    ethers = await getEthers();

    [owner, user1, user2, nonAdmin] = await ethers.getSigners();

    const Token = await ethers.getContractFactory("YourToken");
    token = await Token.deploy("FaucetToken", "FTK", owner.address);
    await token.waitForDeployment();

    const Faucet = await ethers.getContractFactory("TokenFaucet");
    faucet = await Faucet.deploy(await token.getAddress());
    await faucet.waitForDeployment();

    await (await token.setMinter(await faucet.getAddress())).wait();
  });

  // ─────────────────────────────────────────────
  // 1. Token Deployment and Initial State
  // ─────────────────────────────────────────────
  describe("1. Token Deployment and Initial State", function () {
    it("Should deploy with correct name and symbol", async function () {
      expect(await token.name()).to.equal("FaucetToken");
      expect(await token.symbol()).to.equal("FTK");
    });

    it("Should set the correct owner", async function () {
      expect(await token.owner()).to.equal(owner.address);
    });

    it("Should set the minter to the faucet address", async function () {
      expect(await token.minter()).to.equal(await faucet.getAddress());
    });

    it("Should enforce MAX_SUPPLY limit on minting", async function () {
      await token.setMinter(owner.address);
      const maxSupply = await token.MAX_SUPPLY();
      await token.mint(user1.address, maxSupply);
      expect(await token.totalSupply()).to.equal(maxSupply);
      await expect(token.mint(user1.address, 1n)).to.be.revertedWith("YourToken: Exceeds MAX_SUPPLY");
    });
  });

  // ─────────────────────────────────────────────
  // 2. Faucet Deployment and Configuration
  // ─────────────────────────────────────────────
  describe("2. Faucet Deployment and Configuration", function () {
    it("Should store correct token address", async function () {
      expect(await faucet.token()).to.equal(await token.getAddress());
    });

    it("Should set the admin to the deployer", async function () {
      expect(await faucet.admin()).to.equal(owner.address);
    });

    it("Should initialize paused as false", async function () {
      expect(await faucet.isPaused()).to.be.false;
      expect(await faucet.paused()).to.be.false;
    });

    it("Should return MAX_CLAIM_AMOUNT as remaining allowance for new address", async function () {
      expect(await faucet.remainingAllowance(user1.address)).to.equal(MAX_CLAIM_AMOUNT);
    });

    it("Should return true for canClaim for new address", async function () {
      expect(await faucet.canClaim(user1.address)).to.be.true;
    });
  });

  // ─────────────────────────────────────────────
  // 3. Successful Token Claim and Event Emission
  // ─────────────────────────────────────────────
  describe("3. Successful Token Claim and Event Emission", function () {
    it("Should mint tokens to user and emit TokensClaimed event", async function () {
      expect(await token.balanceOf(user1.address)).to.equal(0n);

      const tx = await faucet.connect(user1).requestTokens();
      const receipt = await tx.wait();

      expect(await token.balanceOf(user1.address)).to.equal(FAUCET_AMOUNT);
      expect(await faucet.totalClaimed(user1.address)).to.equal(FAUCET_AMOUNT);

      const block = await ethers.provider.getBlock(receipt.blockNumber);
      expect(await faucet.lastClaimAt(user1.address)).to.equal(block.timestamp);

      await expect(tx)
        .to.emit(faucet, "TokensClaimed")
        .withArgs(user1.address, FAUCET_AMOUNT, block.timestamp);
    });
  });

  // ─────────────────────────────────────────────
  // 4. Cooldown Enforcement
  // ─────────────────────────────────────────────
  describe("4. Cooldown Enforcement", function () {
    it("Should revert on immediate re-claim", async function () {
      await faucet.connect(user1).requestTokens();
      await expect(faucet.connect(user1).requestTokens()).to.be.revertedWith(
        "Cooldown period not elapsed"
      );
    });

    it("Should revert before 24 hours have elapsed (23h 59m)", async function () {
      await faucet.connect(user1).requestTokens();
      await increaseTime(23 * 3600 + 59 * 60);
      await expect(faucet.connect(user1).requestTokens()).to.be.revertedWith(
        "Cooldown period not elapsed"
      );
    });

    it("Should allow claiming after exactly 24 hours", async function () {
      await faucet.connect(user1).requestTokens();
      await increaseTime(COOLDOWN_TIME);
      await expect(faucet.connect(user1).requestTokens()).to.not.revert(ethers);
      expect(await token.balanceOf(user1.address)).to.equal(FAUCET_AMOUNT * 2n);
    });
  });

  // ─────────────────────────────────────────────
  // 5. Lifetime Limit Enforcement
  // ─────────────────────────────────────────────
  describe("5. Lifetime Limit Enforcement", function () {
    it("Should revert after reaching 1000-token lifetime limit (10 claims)", async function () {
      for (let i = 0; i < 10; i++) {
        await faucet.connect(user1).requestTokens();
        await increaseTime(COOLDOWN_TIME);
      }
      expect(await faucet.totalClaimed(user1.address)).to.equal(MAX_CLAIM_AMOUNT);
      expect(await faucet.remainingAllowance(user1.address)).to.equal(0n);
      expect(await faucet.canClaim(user1.address)).to.be.false;

      await expect(faucet.connect(user1).requestTokens()).to.be.revertedWith(
        "Lifetime claim limit reached"
      );
    });
  });

  // ─────────────────────────────────────────────
  // 6. Pause Mechanism
  // ─────────────────────────────────────────────
  describe("6. Pause Mechanism", function () {
    it("Should emit FaucetPaused(true) and block claims when paused", async function () {
      const tx = await faucet.connect(owner).setPaused(true);
      await expect(tx).to.emit(faucet, "FaucetPaused").withArgs(true);
      expect(await faucet.isPaused()).to.be.true;
      expect(await faucet.canClaim(user1.address)).to.be.false;
      await expect(faucet.connect(user1).requestTokens()).to.be.revertedWith("Faucet is paused");
    });

    it("Should resume claims after unpausing", async function () {
      await faucet.connect(owner).setPaused(true);
      await faucet.connect(owner).setPaused(false);
      expect(await faucet.isPaused()).to.be.false;
      await expect(faucet.connect(user1).requestTokens()).to.not.revert(ethers);
    });

    it("Should revert if non-admin tries to toggle pause", async function () {
      await expect(faucet.connect(nonAdmin).setPaused(true)).to.be.revertedWith(
        "TokenFaucet: Only admin can perform this action"
      );
    });
  });

  // ─────────────────────────────────────────────
  // 7. Insufficient Supply Edge Case
  // ─────────────────────────────────────────────
  describe("7. Insufficient Faucet Balance / Max Supply Edge Case", function () {
    it("Should revert when token MAX_SUPPLY would be exceeded", async function () {
      await token.setMinter(owner.address);
      const maxSupply = await token.MAX_SUPPLY();
      await token.mint(owner.address, maxSupply - parseEther("50"));
      await token.setMinter(await faucet.getAddress());

      await expect(faucet.connect(user1).requestTokens()).to.be.revertedWith(
        "Faucet has insufficient token balance"
      );
      expect(await faucet.canClaim(user1.address)).to.be.false;
    });
  });

  // ─────────────────────────────────────────────
  // 8. Independent Users
  // ─────────────────────────────────────────────
  describe("8. Independent Users", function () {
    it("Should track cooldowns independently per user", async function () {
      await faucet.connect(user1).requestTokens();
      expect(await faucet.canClaim(user2.address)).to.be.true;
      await expect(faucet.connect(user2).requestTokens()).to.not.revert(ethers);
      expect(await token.balanceOf(user1.address)).to.equal(FAUCET_AMOUNT);
      expect(await token.balanceOf(user2.address)).to.equal(FAUCET_AMOUNT);
    });
  });
});
