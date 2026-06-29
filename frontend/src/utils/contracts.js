// frontend/src/utils/contracts.js
// Provides ethers.js helpers to interact with deployed Token and Faucet contracts.
import { ethers } from "ethers";
import contractsData from "./contractsData.json";

export const { tokenAddress, faucetAddress, tokenAbi, faucetAbi, network, chainId } =
  contractsData;

/**
 * Returns a BrowserProvider backed by window.ethereum (EIP-1193).
 */
export function getProvider() {
  if (!window.ethereum) throw new Error("No Web3 wallet detected. Please install MetaMask.");
  return new ethers.BrowserProvider(window.ethereum);
}

/** Returns the connected signer (prompts MetaMask if not connected). */
export async function getSigner() {
  const provider = getProvider();
  return provider.getSigner();
}

/** Returns a read-only Token contract instance. */
export function getTokenContract(signerOrProvider) {
  return new ethers.Contract(tokenAddress, tokenAbi, signerOrProvider);
}

/** Returns a writeable Faucet contract instance. */
export function getFaucetContract(signerOrProvider) {
  return new ethers.Contract(faucetAddress, faucetAbi, signerOrProvider);
}

/**
 * Returns the token balance of `address` as a human-readable string (ETH units).
 */
export async function getBalance(address) {
  const provider = getProvider();
  const token = getTokenContract(provider);
  const raw = await token.balanceOf(address);
  return ethers.formatEther(raw);
}

/**
 * Sends a requestTokens() transaction from the connected wallet.
 * Returns the transaction receipt.
 */
export async function requestTokens() {
  const signer = await getSigner();
  const faucet = getFaucetContract(signer);
  const tx = await faucet.requestTokens();
  return tx.wait();
}

/** Returns true if `address` can currently claim tokens. */
export async function canClaim(address) {
  const provider = getProvider();
  const faucet = getFaucetContract(provider);
  return faucet.canClaim(address);
}

/** Returns the remaining lifetime allowance for `address` in ETH units. */
export async function getRemainingAllowance(address) {
  const provider = getProvider();
  const faucet = getFaucetContract(provider);
  const raw = await faucet.remainingAllowance(address);
  return ethers.formatEther(raw);
}

/** Returns the last claim timestamp (as a BigInt) for `address`. */
export async function getLastClaimAt(address) {
  const provider = getProvider();
  const faucet = getFaucetContract(provider);
  return faucet.lastClaimAt(address);
}

/** Returns the total claimed amount for `address` in ETH units. */
export async function getTotalClaimed(address) {
  const provider = getProvider();
  const faucet = getFaucetContract(provider);
  const raw = await faucet.totalClaimed(address);
  return ethers.formatEther(raw);
}

/** Returns the deployed contract addresses. */
export function getContractAddresses() {
  return { tokenAddress, faucetAddress };
}
