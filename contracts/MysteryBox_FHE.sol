pragma solidity ^0.8.24;

import { FHE, euint32, externalEuint32 } from "@fhevm/solidity/lib/FHE.sol";
import { ZamaEthereumConfig } from "@fhevm/solidity/config/ZamaConfig.sol";

contract MysteryBoxFHE is ZamaEthereumConfig {
    struct SubscriptionBox {
        address subscriber;
        euint32 encryptedPreferences;
        uint256 publicMetadata;
        uint256 creationTimestamp;
        uint256 matchTimestamp;
        bool isMatched;
        uint32 decryptedMatchValue;
    }

    struct Product {
        string encryptedData;
        uint256 stock;
        uint256 price;
        bool isActive;
    }

    mapping(address => SubscriptionBox) public subscriptionBoxes;
    mapping(uint256 => Product) public products;
    mapping(address => bool) public hasActiveSubscription;

    address[] public subscribers;
    uint256[] public productIds;

    event SubscriptionCreated(address indexed subscriber);
    event ProductAdded(uint256 indexed productId);
    event BoxMatched(address indexed subscriber, uint256 indexed productId);

    constructor() ZamaEthereumConfig() {
    }

    function createSubscription(
        externalEuint32 encryptedPreferences,
        bytes calldata inputProof,
        uint256 publicMetadata
    ) external {
        require(!hasActiveSubscription[msg.sender], "Active subscription exists");

        require(FHE.isInitialized(FHE.fromExternal(encryptedPreferences, inputProof)), "Invalid encrypted input");

        subscriptionBoxes[msg.sender] = SubscriptionBox({
            subscriber: msg.sender,
            encryptedPreferences: FHE.fromExternal(encryptedPreferences, inputProof),
            publicMetadata: publicMetadata,
            creationTimestamp: block.timestamp,
            matchTimestamp: 0,
            isMatched: false,
            decryptedMatchValue: 0
        });

        FHE.allowThis(subscriptionBoxes[msg.sender].encryptedPreferences);
        FHE.makePubliclyDecryptable(subscriptionBoxes[msg.sender].encryptedPreferences);

        hasActiveSubscription[msg.sender] = true;
        subscribers.push(msg.sender);

        emit SubscriptionCreated(msg.sender);
    }

    function addProduct(
        uint256 productId,
        string calldata encryptedData,
        uint256 stock,
        uint256 price
    ) external {
        require(products[productId].stock == 0, "Product already exists");

        products[productId] = Product({
            encryptedData: encryptedData,
            stock: stock,
            price: price,
            isActive: true
        });

        productIds.push(productId);
        emit ProductAdded(productId);
    }

    function matchSubscription(address subscriber, uint256 productId) external {
        require(hasActiveSubscription[subscriber], "No active subscription");
        require(products[productId].isActive, "Product not available");
        require(products[productId].stock > 0, "Product out of stock");
        require(!subscriptionBoxes[subscriber].isMatched, "Subscription already matched");

        // Homomorphic matching would occur here
        subscriptionBoxes[subscriber].isMatched = true;
        subscriptionBoxes[subscriber].matchTimestamp = block.timestamp;
        products[productId].stock--;

        emit BoxMatched(subscriber, productId);
    }

    function verifyDecryption(
        address subscriber,
        bytes memory abiEncodedClearValue,
        bytes memory decryptionProof
    ) external {
        require(hasActiveSubscription[subscriber], "No active subscription");
        require(subscriptionBoxes[subscriber].isMatched, "Subscription not matched");

        bytes32[] memory cts = new bytes32[](1);
        cts[0] = FHE.toBytes32(subscriptionBoxes[subscriber].encryptedPreferences);

        FHE.checkSignatures(cts, abiEncodedClearValue, decryptionProof);

        uint32 decodedValue = abi.decode(abiEncodedClearValue, (uint32));
        subscriptionBoxes[subscriber].decryptedMatchValue = decodedValue;
    }

    function updateProductStock(uint256 productId, uint256 newStock) external {
        require(products[productId].isActive, "Product not available");
        products[productId].stock = newStock;
    }

    function getProduct(uint256 productId) external view returns (
        string memory encryptedData,
        uint256 stock,
        uint256 price,
        bool isActive
    ) {
        Product storage product = products[productId];
        return (product.encryptedData, product.stock, product.price, product.isActive);
    }

    function getSubscriptionBox(address subscriber) external view returns (
        euint32 encryptedPreferences,
        uint256 publicMetadata,
        uint256 creationTimestamp,
        uint256 matchTimestamp,
        bool isMatched,
        uint32 decryptedMatchValue
    ) {
        require(hasActiveSubscription[subscriber], "No active subscription");
        
        SubscriptionBox storage box = subscriptionBoxes[subscriber];
        return (
            box.encryptedPreferences,
            box.publicMetadata,
            box.creationTimestamp,
            box.matchTimestamp,
            box.isMatched,
            box.decryptedMatchValue
        );
    }

    function getAllSubscribers() external view returns (address[] memory) {
        return subscribers;
    }

    function getAllProductIds() external view returns (uint256[] memory) {
        return productIds;
    }

    function cancelSubscription(address subscriber) external {
        require(hasActiveSubscription[subscriber], "No active subscription");
        require(!subscriptionBoxes[subscriber].isMatched, "Cannot cancel matched subscription");

        delete subscriptionBoxes[subscriber];
        hasActiveSubscription[subscriber] = false;

        // Remove subscriber from array
        for (uint i = 0; i < subscribers.length; i++) {
            if (subscribers[i] == subscriber) {
                subscribers[i] = subscribers[subscribers.length - 1];
                subscribers.pop();
                break;
            }
        }
    }
}

