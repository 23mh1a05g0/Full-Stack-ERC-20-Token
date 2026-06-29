// frontend/src/utils/eval.js
// Implements the window.__EVAL__ interface required by the evaluation harness.
import {
  getProvider,
  getSigner,
  getBalance,
  requestTokens as _requestTokens,
  canClaim as _canClaim,
  getRemainingAllowance,
  getContractAddresses,
} from "./contracts.js";

/**
 * Connects the user's wallet via MetaMask (EIP-1193) and returns the address.
 */
async function connectWallet() {
  if (!window.ethereum) throw new Error("MetaMask not found");
  const accounts = await window.ethereum.request({ method: "eth_requestAccounts" });
  return accounts[0];
}

/**
 * Requests tokens for the currently connected wallet.
 * Returns the transaction receipt.
 */
async function requestTokens() {
  return _requestTokens();
}

/**
 * Returns the FTK balance of the given address as a decimal string (18 decimals).
 * @param {string} address
 */
async function getBalanceEval(address) {
  return getBalance(address);
}

/**
 * Returns true if the given address can currently claim tokens.
 * @param {string} address
 */
async function canClaimEval(address) {
  return _canClaim(address);
}

/**
 * Returns the remaining lifetime token allowance for the given address.
 * @param {string} address
 */
async function getRemainingAllowanceEval(address) {
  return getRemainingAllowance(address);
}

/**
 * Returns the deployed contract addresses.
 * @returns {{ tokenAddress: string, faucetAddress: string }}
 */
function getContractAddressesEval() {
  return getContractAddresses();
}

// Expose the evaluation interface on window
window.__EVAL__ = {
  connectWallet,
  requestTokens,
  getBalance: getBalanceEval,
  canClaim: canClaimEval,
  getRemainingAllowance: getRemainingAllowanceEval,
  getContractAddresses: getContractAddressesEval,
};
