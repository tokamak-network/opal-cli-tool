const fs = require("fs");
const path = require("path");

// Define the content for the new Treasury.sol file
const treasuryContent = `
// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import { SafeERC20 } from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import { IERC1155Receiver } from "@openzeppelin/contracts/token/ERC1155/IERC1155Receiver.sol";
import { ReentrancyGuard } from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";


/**
 * @title Treasury Contract for Token managememnt
 * @author TOKAMAK OPAL TEAM
 * @notice This contract manages the storage and transfer of NFT tokens and WSTON tokens within the ecosystem.
 * It facilitates interactions with the assetFactory contract.
 * The contract includes functionalities for creating premined NFTs, handling token transfers, and managing sales on the marketplace.
 * @dev The contract integrates with external interfaces for NFT creation, marketplace operations, and token swaps.
 * It includes security features such as pausing operations and role-based access control.
 */

interface IAssetFactory {
    struct Asset {
        // add any additionnal features here
        uint256 tokenId;
        uint256 wstonValuePerNFT; // 27 decimals
        uint256 totalWstonValue; // 27 decimals
        string uri;
    }

    function mintAsset(uint256 _tokenId, address _to, uint256 _numberOfNFTToMint) external;

    function safeTransferFrom(address from, address to, uint256 tokenId, uint256 numberOfTokens, bytes memory data) external;

    function getAssetsSupplyTotalValue() external view returns(uint256 totalValue);

    function getApproved(uint256 tokenId) external view returns (address);

    function approve(address to, uint256 tokenId) external;

    function getAsset(uint256 tokenId) external view returns (Asset memory);

    function getWstonValuePerNft(uint256 _tokenId) external view returns (uint256);

}

contract Treasury is IERC1155Receiver, ReentrancyGuard, OwnableUpgradeable {
    using SafeERC20 for IERC20;

    address internal assetFactory;
    address internal wston;
    
    bool paused = false;
    bool internal initialized;

    error InvalidAddress();
    error UnsuffiscientWstonBalance();
    error NotEnoughWstonAvailableInTreasury();

    modifier whenNotPaused() {
      require(!paused, "Pausable: paused");
      _;
    }


    modifier whenPaused() {
        require(paused, "Pausable: not paused");
        _;
    }

    modifier onlyOwnerOrAssetFactory() {
      require(msg.sender == owner() || msg.sender == assetFactory, "caller is neither owner nor AssetFactory");
      _;
    }

    function pause() public onlyOwner whenNotPaused {
        paused = true;
    }

    function unpause() public onlyOwner whenPaused {
        paused = false;
    }

    //---------------------------------------------------------------------------------------
    //--------------------------------INITIALIZE FUNCTIONS-----------------------------------
    //---------------------------------------------------------------------------------------

    /**
     * @notice Initializes the Treasury contract with the given parameters.
     * @param _owner owner of the contract
     * @param _wston Address of the WSTON token.
     * @param _assetFactory Address of the NFT factory contract.
     */
    function initialize(address _owner, address _wston, address _assetFactory) external {
        require(!initialized, "already initialized");   
        __Ownable_init(_owner);
        assetFactory = _assetFactory;
        wston = _wston;
        initialized = true;
    }

     /**
     * @notice Sets the address of the NFT factory.
     * @param _assetFactory New address of the NFT factory contract.
     */
    function setAssetFactory(address _assetFactory) external onlyOwner {
        _checkNonAddress(assetFactory);
        assetFactory = _assetFactory;
    }

    /**
     * @notice updates the wston token address
     * @param _wston New wston token address
     */
    function setWston(address _wston) external onlyOwner {
        wston = _wston;
    }

    //---------------------------------------------------------------------------------------
    //--------------------------------EXTERNAL FUNCTIONS-------------------------------------
    //---------------------------------------------------------------------------------------

    /**
     * @notice Transfers WSTON tokens to a specified address.
     * @param _to Address to transfer WSTON tokens to.
     * @param _amount Amount of WSTON tokens to transfer.
     * @dev only the assetFactory, MarketPlace, RandomPack, Airdrop or the Owner are authorized to transfer the funds
     * @return bool Returns true if the transfer is successful.
     */
    function transferWSTON(address _to, uint256 _amount) external onlyOwnerOrAssetFactory nonReentrant returns(bool) {
        // check _to diffrent from address(0)
        _checkNonAddress(_to);

        // check the balance of the treasury
        uint256 contractWSTONBalance = getWSTONBalance();
        if(contractWSTONBalance < _amount) {
            revert UnsuffiscientWstonBalance();
        }

        // transfer to the recipient
        IERC20(wston).safeTransfer(_to, _amount);
        return true;
    }

    /**
     * @notice mints a new NFT for a specific token ID
     * @param _tokenId ID of the token to mint.
     * @param _to beneficiary of the NFT
     * @param _numberOfNFTToMint number of NFT to mint
     * @dev The caller must be the contract owner.
     */
    function mintNewAssets( 
        uint256 _tokenId,
        address _to,
        uint256 _numberOfNFTToMint
    ) external onlyOwner whenNotPaused {
        // safety check for WSTON solvency
        if(getWSTONBalance() < IAssetFactory(assetFactory).getAssetsSupplyTotalValue() + (IAssetFactory(assetFactory).getWstonValuePerNft(_tokenId) * _numberOfNFTToMint)) {
            revert NotEnoughWstonAvailableInTreasury();
        }

        // we create the NFTs from the assetFactory
        IAssetFactory(assetFactory).mintAsset(
            _tokenId,
            _to,
            _numberOfNFTToMint
        );
    }


    /**
     * @notice Transfers a NFT from the treasury to a specified address.
     * @param _to Address to transfer the NFT to.
     * @param _tokenId ID of the token to transfer.
     * @param _numberOfTokens number of NFT to send
     * @param data data to handle errors
     * @dev only the Owner is able to transfer tokens from the treasury
     * @return bool Returns true if the transfer is successful.
     */
    function transferTreasuryTokensto(address _to, uint256 _tokenId, uint256 _numberOfTokens, bytes memory data) external onlyOwner returns(bool) {
        IAssetFactory(assetFactory).safeTransferFrom(address(this), _to, _tokenId, _numberOfTokens, data);
        return true;
    }

    /**
     * @notice Handles the receipt of an ERC1155 token.
     * @return bytes4 Returns the selector of the onERC1155Received function.
     */
    function onERC1155Received(
        address /*operator*/,
        address /*from*/,
        uint256 /*tokenId*/,
        uint256 /*value*/,
        bytes calldata /*data*/
    ) external pure override returns (bytes4) {
        return this.onERC1155Received.selector;
    }

    /**
     * @notice Handles the receipt of a batch of ERC1155 tokens.
     * @return bytes4 Returns the selector of the onERC1155BatchReceived function.
     */
    function onERC1155BatchReceived(
        address /*operator*/,
        address /*from*/,
        uint256[] calldata /*ids*/,
        uint256[] calldata /*values*/,
        bytes calldata /*data*/
    ) external pure returns (bytes4) {
        return this.onERC1155BatchReceived.selector;
    }

    function supportsInterface(bytes4 interfaceId) public view override returns (bool) {
        return this.supportsInterface(interfaceId);
    }

    //---------------------------------------------------------------------------------------
    //--------------------------------INTERNAL FUNCTIONS-------------------------------------
    //---------------------------------------------------------------------------------------

    /**
     * @notice Checks if the provided address is a non-zero address.
     * @param account Address to check.
     */
    function _checkNonAddress(address account) internal pure {
        if(account == address(0))   revert InvalidAddress();
    }

    //---------------------------------------------------------------------------------------
    //------------------------STORAGE GETTER / VIEW FUNCTIONS--------------------------------
    //---------------------------------------------------------------------------------------

    // Function to check the balance of WSTON token within the contract
    function getWSTONBalance() public view returns (uint256) {
        return IERC20(wston).balanceOf(address(this));
    }

    function getAssetFactoryAddress() external view returns (address) {return assetFactory;}
    function getWstonAddress() external view returns(address) {return wston;}

}
`;

// Write the Treasury.sol file
const treasuryPath = path.join(__dirname, "../contracts/Treasury.sol");
fs.writeFileSync(treasuryPath, treasuryContent);

console.log("Treasury.sol created and saved in the contracts folder.");