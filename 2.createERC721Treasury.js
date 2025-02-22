const fs = require("fs");
const path = require("path");

// Define the content for the new Treasury.sol file
const treasuryContent = `
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import { SafeERC20 } from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { IERC721Receiver } from "@openzeppelin/contracts/token/ERC721/IERC721Receiver.sol";
import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import { ReentrancyGuard } from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

interface INFTFactory {
    struct Nft {
        // add any additionnal features here
        uint256 tokenId;  
        uint256 value; // 27 decimals
        string tokenURI; // IPFS address of the metadata file 
    }

    function createNFT( 
        uint256 _value,
        address _owner,
        string memory _tokenURI
    ) external  returns (uint256);

    function createNFTPool(
        uint256[] memory _values,
        address[] memory _owners,
        string[] memory _tokenURIs
    ) external returns (uint256[] memory);

    function transferFrom(address from, address to, uint256 tokenId) external;

    function safeTransferFrom(address from, address to, uint256 tokenId, bytes memory data) external;

    function setTokenURI(uint256 tokenId, string memory _tokenURI) external;

    function ownerOf(uint256 tokenId) external view returns(address);

    function getNFTsSupplyTotalValue() external view returns(uint256 totalValue);

    function getApproved(uint256 tokenId) external view returns (address);

    function approve(address to, uint256 tokenId) external;

    function setApprovalForAll(address operator, bool approved) external;

    function isApprovedForAll(address owner, address operator) external view returns (bool);

    function getNFT(uint256 tokenId) external view returns (Nft memory);

}


/**
 * @title Treasury Contract for Token managememnt
 * @author TOKAMAK OPAL TEAM
 * @notice This contract manages the storage and transfer of NFT tokens and WSTON tokens within the ecosystem.
 * It facilitates interactions with the NFTFactory contract.
 * The contract includes functionalities for creating premined NFTs, handling token transfers, and managing sales on the marketplace.
 * @dev The contract integrates with external interfaces for NFT creation, marketplace operations, and token swaps.
 * It includes security features such as pausing operations and role-based access control.
 */
contract Treasury is IERC721Receiver, ReentrancyGuard, OwnableUpgradeable {
    using SafeERC20 for IERC20;

    address internal nftFactory;
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

    modifier onlyOwnerOrNFTFactory() {
      require(msg.sender == owner() || msg.sender == nftFactory, "caller is neither owner nor NFTFactory");
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
     * @param _nftFactory Address of the NFT factory contract.
     */
    function initialize(address _owner, address _wston, address _nftFactory) external {
        require(!initialized, "already initialized");   
        __Ownable_init(_owner);
        nftFactory = _nftFactory;
        wston = _wston;
        initialized = true;
    }

     /**
     * @notice Sets the address of the NFT factory.
     * @param _nftFactory New address of the NFT factory contract.
     */
    function setNftFactory(address _nftFactory) external onlyOwner {
        _checkNonAddress(nftFactory);
        nftFactory = _nftFactory;
    }

    /**
     * @notice updates the wston token address
     * @param _wston New wston token address
     */
    function setWston(address _wston) external onlyOwner {
        wston = _wston;
    }

    /**
     * @notice Approves a specific operator to manage a NFT token.
     * @param operator Address of the operator.
     * @param _tokenId ID of the token to approve.
     */
    function approveNFT(address operator, uint256 _tokenId) external onlyOwner {
        INFTFactory(nftFactory).approve(operator, _tokenId);
    }

    //---------------------------------------------------------------------------------------
    //--------------------------------EXTERNAL FUNCTIONS-------------------------------------
    //---------------------------------------------------------------------------------------

    /**
     * @notice Transfers WSTON tokens to a specified address.
     * @param _to Address to transfer WSTON tokens to.
     * @param _amount Amount of WSTON tokens to transfer.
     * @dev only the NFTFactory, MarketPlace, RandomPack, Airdrop or the Owner are authorized to transfer the funds
     * @return bool Returns true if the transfer is successful.
     */
    function transferWSTON(address _to, uint256 _amount) external onlyOwnerOrNFTFactory nonReentrant returns(bool) {
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
     * @notice Creates an NFT with specified attributes.
     * @param _value value of WSTON associated with the NFT.
     * @param _owner owner of the new NFT.
     * @param _tokenURI URI o the new NFT.
     * @dev the contract must hold enough WSTON to cover the entire supply of NFTs across all owners
     * @return uint256 Returns the ID of the created NFT.
     */
    function createNFT( 
        uint256 _value,
        address _owner,
        string memory _tokenURI
    ) external onlyOwner whenNotPaused returns (uint256) {
        // safety check for WSTON solvency
        if(getWSTONBalance() < INFTFactory(nftFactory).getNFTsSupplyTotalValue() + _value) {
            revert NotEnoughWstonAvailableInTreasury();
        }

        // we create the NFT from the NFTFactory
        return INFTFactory(nftFactory).createNFT(
            _value,
            _owner,
            _tokenURI
        );
    }

    /**
     * @notice Creates a pool of premined NFTs with specified attributes.
     * @param _values Array of WSTON values associated with each NFT to be created.
     * @dev the contract must hold enough WSTON to cover the entire supply of NFTs across all owners
     * @return uint256[] Returns an array of IDs for the created NFTs.
     */
    function createNFTPool(
        uint256[] memory _values,
        address[] memory _owners,
        string[] memory _tokenURIs
    ) public onlyOwner returns (uint256[] memory) {

        //calculate the value of the pool of NFTs to be created
        uint256 sumOfNewPoolValues;
        for (uint256 i = 0; i < _values.length; ++i) {
            sumOfNewPoolValues += _values[i];
        }

        // add the value calculated to the total supply value and check that the treasury balance holds enough WSTON
        if(getWSTONBalance() < INFTFactory(nftFactory).getNFTsSupplyTotalValue() + sumOfNewPoolValues) {
            revert NotEnoughWstonAvailableInTreasury();
        }

        // we create the pool from the NFTFactory
        return INFTFactory(nftFactory).createNFTPool(
            _values,
            _owners,
            _tokenURIs
        );
    }

    /**
     * @notice Transfers a NFT from the treasury to a specified address.
     * @param _to Address to transfer the NFT to.
     * @param _tokenId ID of the NFT token to transfer.
     * @dev only the NFTFactory, MarketPlace, RandomPack, Airdrop or the Owner are able to transfer NFTs from the treasury
     * @return bool Returns true if the transfer is successful.
     */
    function transferTreasuryNFTto(address _to, uint256 _tokenId) external onlyOwner returns(bool) {
        INFTFactory(nftFactory).transferFrom(address(this), _to, _tokenId);
        return true;
    }

    /**
     * @notice Handles the receipt of an ERC721 token.
     * @return bytes4 Returns the selector of the onERC721Received function.
     */
    function onERC721Received(
        address /*operator*/,
        address /*from*/,
        uint256 /*tokenId*/,
        bytes calldata /*data*/
    ) external pure override returns (bytes4) {
        return this.onERC721Received.selector;
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

    function getNFTFactoryAddress() external view returns (address) {return nftFactory;}
    function getWstonAddress() external view returns(address) {return wston;}

}
`;

// Write the Treasury.sol file
const treasuryPath = path.join(__dirname, "../contracts/Treasury.sol");
fs.writeFileSync(treasuryPath, treasuryContent);

console.log("Treasury.sol created and saved in the contracts folder.");