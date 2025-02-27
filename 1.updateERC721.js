const fs = require("fs");
const path = require("path");

// Path to the existing contract
const contractPath = path.join(__dirname, "../contracts/NFTFactory.sol");

// Read the existing contract
let contractContent = fs.readFileSync(contractPath, "utf8");

// Define the new storage and functions to be added
const newStorage = `
    struct Nft {
        uint256 tokenId;
        uint256 value; // 27 decimals
        string tokenURI; // IPFS address of the metadata file
    }
    Nft[] public Nfts;

    // Contract addresses
    address internal wston;
    address internal treasury;
    
    // events
    event Created(uint256 indexed tokenId, uint256 value, address owner, string tokenURI);
    event NFTBurnt(uint256 indexed tokenId, address owner);

    //errors
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
     * @notice Burns an NFT, converting it back to its value.
     * @param _tokenId ID of the token to burn.
     * @dev The caller receives the WSTON amount associated with the NFT.
     * @dev The ERC721 token is burned.
     * @dev The caller must be the token owner.
     */
    function burnNFT(uint256 _tokenId) external {
        require(msg.sender != address(0), "AddressZero");
        require(ownerOf(_tokenId) == msg.sender, "NotNFTOwner");

        uint256 amount = Nfts[_tokenId].value;
        delete Nfts[_tokenId];
        _burn(_tokenId);

        require(ITreasury(treasury).transferWSTON(msg.sender, amount), "TransferFailed");
        emit NFTBurnt(_tokenId, msg.sender);
    }

    /**
     * @notice Creates an NFT based on its attributes passed in the parameters and assigns their ownership to the owner.
     * @param _value WSTON value of the new NFT to be created.
     * @param _owner Owner of the new NFT.
     * @param _tokenURI TokenURI of the NFT.
     * @return The ID of the newly created NFT.
     */
    function createNFT(uint256 _value, address _owner, string memory _tokenURI)
        public
        onlyTreasury
        returns (uint256)
    {
        require(_owner != address(0), "AddressZero");

        uint256 newNftId = Nfts.length;
        Nfts.push(Nft({
            tokenId: newNftId,
            value: _value,
            tokenURI: _tokenURI
        }));

        _safeMint(_owner, newNftId);

        emit Created(newNftId, _value, _owner, _tokenURI);
        return newNftId;
    }

    /**
     * @notice Creates a pool of NFTs based on their attributes passed in the parameters and assigns their ownership to the owners.
     * @param _values Value of each NFT to be minted.
     * @param _owners Owners of the NFTs to be minted.
     * @param _tokenURIs TokenURIs of each NFT.
     * @return The IDs of the newly created NFTs.
     */
    function createNFTPool(
        uint256[] memory _values,
        address[] memory _owners,
        string[] memory _tokenURIs
    ) public onlyTreasury returns (uint256[] memory) {
        require(_values.length == _owners.length && _values.length == _tokenURIs.length, "Wrong parameters length");

        uint256[] memory newNftIds = new uint256[](_values.length);
        for (uint256 i = 0; i < _values.length; i++) {
            newNftIds[i] = createNFT(_values[i], _owners[i], _tokenURIs[i]);
        }

        return newNftIds;
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
    ) external pure returns (bytes4) {
        return this.onERC721Received.selector;
    }
`;

// Define the new imports and interfaces
const newImports = `
import { IERC721Receiver } from "@openzeppelin/contracts/token/ERC721/IERC721Receiver.sol";
`;

const newInterfaces = `
interface ITreasury {
    function transferWSTON(address recipient, uint256 amount) external returns (bool);
}
`;

// Inject new imports after the existing imports
contractContent = contractContent.replace(
    /import "@openzeppelin\/contracts\/token\/ERC721\/ERC721.sol";/,
    `import "@openzeppelin/contracts/token/ERC721/ERC721.sol";`
);

// Extract the contract declaration line
const contractDeclarationRegex = /contract\s+(\w+)\s+is\s+([^{]+)\s*{/;
const contractDeclarationMatch = contractContent.match(contractDeclarationRegex);

if (contractDeclarationMatch) {
    const contractName = contractDeclarationMatch[1];
    const existingInheritance = contractDeclarationMatch[2];

    // Modify the contract declaration to include new inheritance and storage
    const updatedContractDeclaration = `${newImports}\n${newInterfaces}\ncontract UpdatedNFTFactory is ${existingInheritance}, IERC721Receiver {${newStorage}`;

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
const updatedContractPath = path.join(__dirname, "../contracts/UpdatedNFTFactory.sol");
fs.writeFileSync(updatedContractPath, contractContent);

console.log("Contract updated and saved to UpdatedGameItem.sol");