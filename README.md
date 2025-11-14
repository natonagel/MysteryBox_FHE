# MysteryBox_FHE: A Confidential Subscription Experience

MysteryBox_FHE is an innovative e-commerce solution that redefines the subscription box experience by ensuring user preferences are kept private throughout the process. Powered by Zama's Fully Homomorphic Encryption (FHE) technology, this application allows users to securely communicate their preferences without exposing sensitive data, enabling merchants to process and match products without ever seeing the underlying user information.

## The Problem

In today's data-driven world, privacy concerns have become paramount, particularly when users are asked to disclose personal preferences for e-commerce subscriptions. Many services rely on cleartext data, which can lead to potential leaks and misuse of sensitive information. User preferences, if not securely managed, can be accessed by malicious actors, leading to privacy violations and a lack of trust in the platform.

MysteryBox_FHE addresses this gap by allowing users to submit their preferences in an encrypted format, ensuring that privacy is maintained while still allowing merchants to deliver personalized products. 

## The Zama FHE Solution

By leveraging Zama's FHE technology, MysteryBox_FHE enables secure computation on encrypted inputs. This means that the preferences users submit remain encrypted throughout the entire process, ensuring total confidentiality. Using the fhevm, merchants can match products to user preferences without ever seeing the raw data. This not only enhances user privacy but also builds trust in the platform, leading to an improved customer experience.

## Key Features

- 🔒 **Encrypted Preferences**: Users submit their preferences securely without revealing any sensitive information.
- 🛍️ **Homomorphic Product Matching**: Merchants can perform computations on encrypted preferences to match and send products seamlessly.
- 🎁 **Surprise Deliveries**: Users receive curated mystery boxes without knowing the contents beforehand, enhancing the excitement of unboxing.
- 🔑 **Privacy Protection**: Guarantees that user preferences remain confidential throughout the subscription process.

## Technical Architecture & Stack

MysteryBox_FHE is built on the following technological stack:

- **Frontend**: React.js for a dynamic user interface.
- **Backend**: Node.js to handle API requests and business logic.
- **Privacy Engine**: Zama's FHE technology platform:
  - **fhevm**: For processing encrypted inputs.
  - Additional dependencies for user preference management and product catalog handling.

## Smart Contract / Core Logic

Below is a simplified pseudo-code snippet that showcases how the core logic utilizes Zama's FHE capabilities. 

```solidity
pragma solidity ^0.8.0;

import "Zama/TFHE.sol";

contract MysteryBox {
    function submitPreferences(uint64[] encryptedPreferences) public {
        // Process encrypted preferences using TFHE functions
        uint64 decryptedData = TFHE.decrypt(encryptedPreferences);
        
        // Further matching logic here...
    }

    function matchProducts(uint64 encryptedUserPref) public view returns (uint64) {
        // Execute product matching algorithm on encrypted data
        uint64 matchedProduct = TFHE.add(encryptedUserPref, /* product criteria */);
        return matchedProduct;
    }
}
```

## Directory Structure

The directory structure of the MysteryBox_FHE project is organized as follows:

```
MysteryBox_FHE/
├── src/
│   ├── components/
│   ├── pages/
│   ├── App.js
│   └── index.js
├── contracts/
│   └── MysteryBox.sol
├── scripts/
│   └── main.py
├── package.json
└── README.md
```

## Installation & Setup

**Prerequisites:**
- Ensure you have Node.js and npm installed on your system.
- Python 3.x for backend services.

**Installation Steps:**

1. Install the necessary dependencies using npm:
    ```bash
    npm install
    ```

2. Install Zama’s FHE library for processing data securely:
    ```bash
    npm install fhevm
    ```

3. For Python dependencies, navigate to the `scripts` directory and run:
    ```bash
    pip install concrete-ml
    ```

## Build & Run

To build and run the MysteryBox_FHE project, simply execute the following commands:

1. To compile the smart contracts:
    ```bash
    npx hardhat compile
    ```

2. To start the Node.js server:
    ```bash
    npm start
    ```

3. To run the Python script for any additional processing:
    ```bash
    python scripts/main.py
    ```

## Acknowledgements

This project would not be possible without the incredible work by Zama, providing open-source Fully Homomorphic Encryption primitives that empower applications like MysteryBox_FHE. Their commitment to privacy solutions enables a new era of secure computation and user trust in digital interactions.

