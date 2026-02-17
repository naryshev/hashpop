// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title HederaAccountService
 * @notice Wrapper for Hedera HIP-632 system contract at 0x167 (ED25519 signature verification).
 * @dev See https://docs.hedera.com/hedera/core-concepts/smart-contracts/understanding-hederas-evm-differences-and-compatibility/for-hedera-native-developers-adding-smart-contract-functionality/integrating-ed25519-accounts-and-advanced-features-into-smart-contracts
 */
library HederaAccountService {
    address internal constant PRECOMPILE = address(0x167);

    /**
     * @notice Verify a single ED25519 signature for the given account.
     * @param accountAlias Hedera account alias (virtual address / EVM address of the account).
     * @param messageHash keccak256 hash of the message that was signed.
     * @param signature Raw ED25519 signature bytes (64 bytes).
     * @return success True if the signature is valid for the account.
     */
    function isAuthorizedRaw(
        address accountAlias,
        bytes32 messageHash,
        bytes calldata signature
    ) internal returns (bool success) {
        (success, ) = PRECOMPILE.call(
            abi.encodeWithSignature(
                "isAuthorizedRaw(address,bytes32,bytes)",
                accountAlias,
                messageHash,
                signature
            )
        );
    }
}
