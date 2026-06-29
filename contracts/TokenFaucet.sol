// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "./Token.sol";

contract TokenFaucet {
    // Reference to the token contract
    YourToken public token;

    // Constants
    uint256 public constant FAUCET_AMOUNT = 100 * 10**18;      // 100 tokens per claim
    uint256 public constant COOLDOWN_TIME = 24 hours;           // 24 hours cooldown
    uint256 public constant MAX_CLAIM_AMOUNT = 1000 * 10**18;   // 1000 tokens lifetime limit

    // Administrative state
    address public admin;
    bool public paused;

    // Mappings to track claims
    mapping(address => uint256) public lastClaimAt;
    mapping(address => uint256) public totalClaimed;

    // Events
    event TokensClaimed(address indexed user, uint256 amount, uint256 timestamp);
    event FaucetPaused(bool paused);

    // Modifiers
    modifier onlyAdmin() {
        require(msg.sender == admin, "TokenFaucet: Only admin can perform this action");
        _;
    }

    constructor(address _tokenAddress) {
        require(_tokenAddress != address(0), "TokenFaucet: Invalid token address");
        token = YourToken(_tokenAddress);
        admin = msg.sender;
        paused = false;
    }

    /**
     * @dev Claims FAUCET_AMOUNT tokens for the caller.
     * Enforces pause state, 24-hour cooldown, and lifetime allowance limits.
     */
    function requestTokens() external {
        // 1. Check faucet is not paused
        require(!paused, "Faucet is paused");

        // 2. Check if lifetime limit has already been reached or would be exceeded
        uint256 claimed = totalClaimed[msg.sender];
        require(claimed < MAX_CLAIM_AMOUNT, "Lifetime claim limit reached");

        // 3. Check if cooldown period has elapsed
        uint256 lastClaim = lastClaimAt[msg.sender];
        if (lastClaim != 0) {
            require(block.timestamp >= lastClaim + COOLDOWN_TIME, "Cooldown period not elapsed");
        }

        // 4. Check if faucet has insufficient token balance (in terms of token MAX_SUPPLY capacity)
        uint256 currentSupply = token.totalSupply();
        uint256 maxSupply = token.MAX_SUPPLY();
        require(currentSupply + FAUCET_AMOUNT <= maxSupply, "Faucet has insufficient token balance");

        // 5. Update state variables (Checks-Effects-Interactions pattern)
        lastClaimAt[msg.sender] = block.timestamp;
        totalClaimed[msg.sender] = claimed + FAUCET_AMOUNT;

        // 6. Mint tokens to user
        token.mint(msg.sender, FAUCET_AMOUNT);

        // 7. Emit events
        emit TokensClaimed(msg.sender, FAUCET_AMOUNT, block.timestamp);
    }

    /**
     * @dev Check if the user is currently eligible to claim tokens.
     */
    function canClaim(address user) external view returns (bool) {
        if (paused) {
            return false;
        }
        if (totalClaimed[user] >= MAX_CLAIM_AMOUNT) {
            return false;
        }
        uint256 lastClaim = lastClaimAt[user];
        if (lastClaim != 0 && block.timestamp < lastClaim + COOLDOWN_TIME) {
            return false;
        }
        
        // Also check if minting exceeds max supply
        if (token.totalSupply() + FAUCET_AMOUNT > token.MAX_SUPPLY()) {
            return false;
        }
        
        return true;
    }

    /**
     * @dev Calculate the remaining allowance for a user.
     */
    function remainingAllowance(address user) public view returns (uint256) {
        uint256 claimed = totalClaimed[user];
        if (claimed >= MAX_CLAIM_AMOUNT) {
            return 0;
        }
        return MAX_CLAIM_AMOUNT - claimed;
    }

    /**
     * @dev Pause/unpause faucet claims. Restricted to the admin.
     */
    function setPaused(bool _paused) external onlyAdmin {
        paused = _paused;
        emit FaucetPaused(_paused);
    }

    /**
     * @dev Return the current paused status of the faucet.
     */
    function isPaused() external view returns (bool) {
        return paused;
    }
}
