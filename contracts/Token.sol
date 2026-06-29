// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

contract YourToken is ERC20, Ownable {
    uint256 public constant MAX_SUPPLY = 1000000000 * 10**18; // 1 Billion tokens (with 18 decimals)
    address public minter;

    event MinterUpdated(address indexed previousMinter, address indexed newMinter);

    constructor(string memory name, string memory symbol, address initialMinter) 
        ERC20(name, symbol) 
        Ownable(msg.sender) 
    {
        minter = initialMinter;
        emit MinterUpdated(address(0), initialMinter);
    }

    /**
     * @dev Set the minter address (the faucet). Only callable by the owner.
     */
    function setMinter(address _minter) external onlyOwner {
        emit MinterUpdated(minter, _minter);
        minter = _minter;
    }

    /**
     * @dev Mint new tokens. Restricted to the minter address.
     * Enforces the MAX_SUPPLY cap.
     */
    function mint(address to, uint256 amount) external {
        require(msg.sender == minter, "YourToken: Only minter can mint");
        require(totalSupply() + amount <= MAX_SUPPLY, "YourToken: Exceeds MAX_SUPPLY");
        _mint(to, amount);
    }
}
