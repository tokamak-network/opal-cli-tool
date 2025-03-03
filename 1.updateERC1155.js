const fs = require("fs");
const path = require("path");

// Path to the existing contract
const contractPath = path.join(__dirname, "../contracts/AssetFactory.sol");

// Read the existing contract
let contractContent = fs.readFileSync(contractPath, "utf8");

// Define the new storage and functions to be added
const newStorage = `
    //---------------------------------------------------------------------------------------
    //--------------------------------------STRUCT-------------------------------------------
    //---------------------------------------------------------------------------------------
    
    struct Asset {
        // add any additionnal features here
        uint256 tokenId;
        uint256 wstonValuePerNFT; // 27 decimals
        uint256 totalWstonValue; // 27 decimals
        string uri;
    }

    //---------------------------------------------------------------------------------------
    //-------------------------------------STORAGE-------------------------------------------
    //---------------------------------------------------------------------------------------

    Asset[] public Assets;
    uint256 public numberOfTokens;

    // contract addresses
    address internal wston;
    address internal treasury;

    // initialized
    bool initialized;

    //---------------------------------------------------------------------------------------
    //-------------------------------------EVENTS--------------------------------------------
    //---------------------------------------------------------------------------------------

    // Premining events
    event Created(
        uint256 indexed tokenId, 
        uint256 wstonValue,
        string uri 
    );

    // mint Events
    event NFTMinted(uint256 tokenId, address to, uint256 numberOfNFTToMint);

    // burn Events
    event NFTBurnt(uint256 tokenId, address owner, uint256 numberOfNFTToBurn);

    //---------------------------------------------------------------------------------------
    //-------------------------------------ERRORS--------------------------------------------
    //---------------------------------------------------------------------------------------

    // setup errors
    error WrongNumberOfValues();

    // minting errors
    error AddressZero();
    error WrongNumberOfNFTToMint();
    error WrongTokenId();

    // tranfer errors
    error TransferFailed();
    
    // access errors
    error UnauthorizedCaller(address caller);
`;

const newFunctions = `
    /**
     * @notice Modifier to ensure the caller is the treasury contract
     */
    modifier onlyTreasury() {
        if (msg.sender != treasury) {
            revert UnauthorizedCaller(msg.sender);
        }
        _;
    }

    /**
     * @notice Initializes the contract with the given parameters.
     * @param _wston Address of the WSTON token.
     * @param _treasury Address of the treasury contract.
     * @param wstonValues values Values associated with each token Id
     * @param uris uris associated with each token Id
     */
    function initialize(
        address _wston, 
        address _treasury,
        uint256[] memory wstonValues,
        string[] memory uris
    ) external onlyOwner {
        require(initialized == false, "already initialized");
        wston = _wston;
        treasury = _treasury;
        for(uint256 i = 0; i < wstonValues.length; i++) {
            // Create the new asset 
            Asset memory newAsset = Asset({
                tokenId: i,
                wstonValuePerNFT: wstonValues[i],
                totalWstonValue: 0,
                uri: uris[i]
            });
            Assets.push(newAsset);

            // Emit an event for the creation of the new NFT
            emit Created(i, wstonValues[i], uris[i]);
        }
        numberOfTokens += wstonValues.length - 1;
        initialized == true;
    }

    /**
     * @notice Sets the treasury address.
     * @param _treasury The new treasury address.
     */
    function setTreasury(address _treasury) external onlyOwner {
        treasury = _treasury;
    }

    /**
     * @notice Updates the wston token address.
     * @param _wston New wston token address.
     */
    function setWston(address _wston) external onlyOwner {
        wston = _wston;
    }

    /**
     * @notice updates the wston value associated with each tokenId
     * @param wstonValues New wston values array.
     */
    function setWstonValuesAssociatedWtihTokenIds(uint256[] memory wstonValues) external onlyOwner {
        if(wstonValues.length != Assets.length) {
            revert WrongNumberOfValues();
        }

        for(uint256 i = 0; i < wstonValues.length; i++) {
            Assets[i].wstonValuePerNFT = wstonValues[i];
        }
    }

    /**
     * @notice mints a new NFT for a specific token ID
     * @param _tokenId ID of the token to mint.
     * @param _to beneficiary of the NFT
     * @param _numberOfNFTToMint number of NFT to mint
     * @dev The caller must be the treasury.
     */
    function mintAsset(uint256 _tokenId, address _to, uint256 _numberOfNFTToMint) external onlyTreasury {
        // reverts if wrong number of NFT to mint
        if(_numberOfNFTToMint == 0) {
            revert WrongNumberOfNFTToMint();
        }
        // Check if the recipient's address is zero
        if (_to == address(0)) {
            revert AddressZero();
        }

        // if the token id passed in parameter does not exist
        if(_tokenId > numberOfTokens) {
            revert WrongTokenId();
        }
        
        // updates storage
        uint256 wstonValueOfNFTs = Assets[_tokenId].wstonValuePerNFT * _numberOfNFTToMint;
        Assets[_tokenId].totalWstonValue += wstonValueOfNFTs;
        // mint the NFT
        _mint(_to, _tokenId, _numberOfNFTToMint, "");
        emit NFTMinted(_tokenId, _to, _numberOfNFTToMint);
    }

    /**
     * @notice burns an asset token, converting it back to its value.
     * @param _tokenId ID of the token to melt.
     * @dev The caller receives the WSTON amount associated with the NFT.
     * @dev The ERC1155 token is burned.
     * @dev The caller must be the token owner.
     */
    function burnAsset(uint256 _tokenId, uint256 _numberOfNFTToBurn) external {
        // Check if the caller's address is zero
        if (msg.sender == address(0)) {
            revert AddressZero();
        }

        //updates storage
        uint256 totalWstonValueToTransfer = Assets[_tokenId].wstonValuePerNFT * _numberOfNFTToBurn;
        Assets[_tokenId].totalWstonValue -= totalWstonValueToTransfer;

        // Burn the ERC1155 token
        _burn(msg.sender, _tokenId, _numberOfNFTToBurn);
        // Transfer the WSTON amount to the caller
        if (!ITreasury(treasury).transferWSTON(msg.sender, totalWstonValueToTransfer)) {
            revert TransferFailed();
        }
        // Emit an event indicating the NFT has been melted
        emit NFTBurnt(_tokenId, msg.sender, _numberOfNFTToBurn);
    }

    /**
     * @notice Creates a new ERC1155 type of NFT.
     * @param _wstonValue WSTON value of the new NFT to be created.
     * @param _uri TokenURI of the NFT.
     */
    function createAsset(uint256 _wstonValue, string memory _uri)
        public
        onlyOwner
    {
        // Create the new asset 
        Asset memory newAsset = Asset({
            tokenId: numberOfTokens,
            wstonValuePerNFT: _wstonValue,
            totalWstonValue: 0,
            uri: _uri
        });
        Assets.push(newAsset);
        numberOfTokens++;

        // Emit an event for the creation of the new NFT
        emit Created(numberOfTokens, _wstonValue, _uri);
    }

    /**
     * @notice Retrieves the details of a specific NFT by its token ID.
     * @param _tokenId The ID of the NFT to retrieve.
     * @return The NFT struct containing details of the specified NFT.
     */
    function getAsset(uint256 _tokenId) public view returns (Asset memory) {
        return Assets[_tokenId];
    }

    /**
     * @notice Retrieves the total wston value locked for a specific tokenId.
     * @param _tokenId The token Id.
     */
    function getTotalWstonValue(uint256 _tokenId) external view returns(uint256) {
        return Assets[_tokenId].totalWstonValue;
    }

    /**
     * @notice Retrieves the wston value of a single NFT for a specific tokenId.
     * @param _tokenId The token Id.
     */
    function getWstonValuePerNft(uint256 _tokenId) external view returns(uint256) {
        return Assets[_tokenId].wstonValuePerNFT;
    } 

    /**
     * @notice Calculates the total value of all Assets in supply.
     * @return totalValue The cumulative value of all Assets.
     */
    function getAssetsSupplyTotalValue() external view returns (uint256 totalValue) {
        uint256 Assetslength = Assets.length;

        // Sum the values of all Assets to get the total supply value
        for (uint256 i = 0; i < Assetslength; ++i) {
            totalValue += Assets[i].totalWstonValue;
        }
    }

    /**
     * @notice returns the uri associated with a specific tokenId
     */
    function uri(uint256 _tokenId) public view override returns(string memory) {
        return Assets[_tokenId].uri;
    }

    //---------------------------------------------------------------------------------------
    //-------------------------------STORAGE GETTERS-----------------------------------------
    //---------------------------------------------------------------------------------------

    function getTreasuryAddress() external view returns (address) {
        return treasury;
    }

    function getWstonAddress() external view returns (address) {
        return wston;
    }


`;


const newInterfaces = `
interface ITreasury {
    function transferWSTON(address _to, uint256 _amount) external returns (bool);
}
`;

// Inject new imports after the existing imports
contractContent = contractContent.replace(
    /import "@openzeppelin\/contracts\/token\/ERC1155\/ERC1155.sol";/,
    `import "@openzeppelin/contracts/token/ERC1155/ERC1155.sol";`
);

// Extract the contract declaration line
const contractDeclarationRegex = /contract\s+(\w+)\s+is\s+([^{]+)\s*{/;
const contractDeclarationMatch = contractContent.match(contractDeclarationRegex);

if (contractDeclarationMatch) {
    const contractName = contractDeclarationMatch[1];
    const existingInheritance = contractDeclarationMatch[2];

    // Modify the contract declaration to include new inheritance and storage
    const updatedContractDeclaration = `\n${newInterfaces}\ncontract UpdatedAssetFactory is ${existingInheritance} {${newStorage}`;

    // Replace the old contract declaration with the updated one
    contractContent = contractContent.replace(
        contractDeclarationRegex,
        updatedContractDeclaration
    );
} else {
    console.error("Could not find the contract declaration in the source file.");
    process.exit(1);
}

// Inject new interfaces and functions before the last closing brace
contractContent = contractContent.replace(
    /}\s*$/,
    `${newFunctions}\n}`
);

// Write the updated contract to a new file
const updatedContractPath = path.join(__dirname, "../contracts/UpdatedAssetFactory.sol");
fs.writeFileSync(updatedContractPath, contractContent);

console.log("Contract updated and saved to UpdatedGameItem.sol");