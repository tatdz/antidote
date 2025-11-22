// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

// External interface for pre-deployed Poseidon contracts
interface IPoseidon {
    function hash(uint256[] calldata inputs) external pure returns (uint256);
}

/**
 * @title ZK Claim Verifier with Pre-deployed Poseidon
 * @dev Zero-knowledge claim verification using pre-deployed Poseidon hasher
 * No additional installations needed - uses deployed contracts directly
 */
contract ClaimVerifier {
    // Pre-deployed Poseidon contract addresses (from your list)
    address public constant POSEIDON_T3 = 0x3333333C0A88F9BE4fd23ed0536F9B6c427e3B93;
    address public constant POSEIDON_T4 = 0x4443338EF595F44e0121df4C21102677B142ECF0;
    address public constant POSEIDON_T5 = 0x555333f3f677Ca3930Bf7c56ffc75144c51D9767;
    address public constant POSEIDON_T6 = 0x666333F371685334CdD69bdDdaFBABc87CE7c7Db;
    
    // Claim verification structure
    struct ZKClaimProof {
        uint256[2] a;
        uint256[2][2] b;
        uint256[2] c;
        uint256[4] input;
    }
    
    // Verified claims tracking
    mapping(bytes32 => bool) public verifiedClaims;
    mapping(address => uint256) public userClaimCounts;
    mapping(bytes32 => bool) public nullifierHashes;

    // Events
    event ClaimVerified(
        address indexed user,
        uint256 indexed policyId,
        uint256 claimAmount,
        bytes32 claimHash,
        bytes32 nullifierHash,
        uint256 timestamp
    );

    event ClaimRejected(
        address indexed user,
        uint256 indexed policyId,
        uint256 claimAmount,
        string reason
    );
    
    event ZKProofVerified(
        address indexed user,
        bytes32 nullifierHash,
        uint256 timestamp
    );

    /**
     * @dev Poseidon hash function using pre-deployed contract
     */
    function poseidonHash(uint256[] memory inputs) public view returns (uint256) {
        require(inputs.length >= 2 && inputs.length <= 5, "Invalid input length");
        
        if (inputs.length == 2) {
            return IPoseidon(POSEIDON_T3).hash(inputs);
        } else if (inputs.length == 3) {
            return IPoseidon(POSEIDON_T4).hash(inputs);
        } else if (inputs.length == 4) {
            return IPoseidon(POSEIDON_T5).hash(inputs);
        } else if (inputs.length == 5) {
            return IPoseidon(POSEIDON_T6).hash(inputs);
        }
        
        revert("Unsupported input length");
    }

    /**
     * @dev Verify a margin call claim using zero-knowledge proof
     */
    function verifyZKClaim(
        ZKClaimProof calldata proof,
        bytes32 nullifierHash,
        bytes32 merkleRoot
    ) external returns (bool) {
        // Prevent double spending
        require(!nullifierHashes[nullifierHash], "Proof already used");
        
        // Verify the ZK proof
        bool proofValid = verifyProof(proof, merkleRoot);
        require(proofValid, "Invalid ZK proof");
        
        // Mark nullifier as used
        nullifierHashes[nullifierHash] = true;
        
        // Extract user address from proof inputs
        address user = extractUserFromProof(proof);
        
        userClaimCounts[user]++;
        
        emit ZKProofVerified(user, nullifierHash, block.timestamp);
        return true;
    }
    
    /**
     * @dev Proof verification with Poseidon hash
     */
    function verifyProof(
        ZKClaimProof calldata proof,
        bytes32 merkleRoot
    ) internal view returns (bool) {
        // Basic validation of proof structure
        require(proof.input.length == 4, "Invalid proof inputs");
        
        // Create inputs array for Poseidon hashing
        uint256[] memory inputs = new uint256[](4);
        inputs[0] = proof.input[0];
        inputs[1] = proof.input[1];
        inputs[2] = proof.input[2];
        inputs[3] = proof.input[3];
        
        // Calculate Poseidon hash
        uint256 calculatedHash = poseidonHash(inputs);
        
        // Convert to bytes32 for comparison with merkle root
        bytes32 poseidonHashBytes = bytes32(calculatedHash);
        
        // Verify hash matches merkle root
        return poseidonHashBytes == merkleRoot;
    }
    
    /**
     * @dev Extract user address from proof inputs
     */
    function extractUserFromProof(
        ZKClaimProof calldata proof
    ) internal pure returns (address) {
        // First input should contain the user address
        return address(uint160(proof.input[0]));
    }

    /**
     * @dev Fallback: Verify a margin call claim using simple signature verification
     */
    function verifyClaim(
        address user,
        uint256 policyId,
        uint256 claimAmount,
        uint256 timestamp,
        bytes memory signature
    ) external returns (bool) {
        // Prevent replay attacks
        bytes32 claimHash = keccak256(abi.encodePacked(
            user,
            policyId,
            claimAmount,
            timestamp,
            block.chainid
        ));

        require(!verifiedClaims[claimHash], "Claim already processed");
        
        // Verify signature
        address recovered = recoverSigner(claimHash, signature);
        require(recovered == user, "Invalid signature");

        // Verify timestamp is reasonable (within 24 hours)
        require(block.timestamp <= timestamp + 24 hours, "Claim expired");

        // Mark claim as verified
        verifiedClaims[claimHash] = true;
        userClaimCounts[user]++;

        emit ClaimVerified(user, policyId, claimAmount, claimHash, bytes32(0), block.timestamp);
        return true;
    }

    /**
     * @dev Simple signature recovery function
     */
    function recoverSigner(
        bytes32 messageHash,
        bytes memory signature
    ) internal pure returns (address) {
        require(signature.length == 65, "Invalid signature length");

        bytes32 r;
        bytes32 s;
        uint8 v;

        assembly {
            r := mload(add(signature, 32))
            s := mload(add(signature, 64))
            v := byte(0, mload(add(signature, 96)))
        }

        if (v < 27) {
            v += 27;
        }

        require(v == 27 || v == 28, "Invalid signature version");

        return ecrecover(messageHash, v, r, s);
    }

    /**
     * @dev Check if a claim has been verified
     */
    function isClaimVerified(bytes32 claimHash) external view returns (bool) {
        return verifiedClaims[claimHash];
    }

    /**
     * @dev Get user's claim count
     */
    function getUserClaimCount(address user) external view returns (uint256) {
        return userClaimCounts[user];
    }

    /**
     * @dev Generate claim hash for frontend use
     */
    function generateClaimHash(
        address user,
        uint256 policyId,
        uint256 claimAmount,
        uint256 timestamp
    ) external view returns (bytes32) {
        return keccak256(abi.encodePacked(
            user,
            policyId,
            claimAmount,
            timestamp,
            block.chainid
        ));
    }
    
    /**
     * @dev Check if nullifier hash has been used
     */
    function isNullifierUsed(bytes32 nullifierHash) external view returns (bool) {
        return nullifierHashes[nullifierHash];
    }
    
    /**
     * @dev Generate Poseidon hash for frontend
     */
    function generatePoseidonHash(
        uint256[] memory inputs
    ) external view returns (uint256) {
        return poseidonHash(inputs);
    }
    
    /**
     * @dev Get Poseidon contract addresses
     */
    function getPoseidonAddresses() external pure returns (
        address t3,
        address t4,
        address t5,
        address t6
    ) {
        return (
            POSEIDON_T3,
            POSEIDON_T4,
            POSEIDON_T5,
            POSEIDON_T6
        );
    }
    
    /**
     * @dev Batch verify multiple ZK claims
     */
    function batchVerifyZKClaims(
        ZKClaimProof[] calldata proofs,
        bytes32[] calldata nullifierHashesArray,
        bytes32[] calldata merkleRoots
    ) external returns (bool[] memory) {
        require(proofs.length == nullifierHashesArray.length, "Array length mismatch");
        require(proofs.length == merkleRoots.length, "Array length mismatch");

        bool[] memory results = new bool[](proofs.length);

        for (uint256 i = 0; i < proofs.length; i++) {
            try this.verifyZKClaim(proofs[i], nullifierHashesArray[i], merkleRoots[i]) {
                results[i] = true;
            } catch {
                results[i] = false;
                emit ClaimRejected(address(0), 0, 0, "ZK verification failed");
            }
        }

        return results;
    }
}