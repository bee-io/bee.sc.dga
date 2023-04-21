// SPDX-License-Identifier: MIT
pragma solidity 0.8.19;

import "./IAbstractGame.sol";

/**
 * @title IRNAbstractGame - An interface for abstract game contracts with random number features
 * @notice This interface extends the IAbstractGame interface and includes additional functionality for handling random numbers and game expiration.
 */
interface IRNAbstractGame is IAbstractGame {
    /**
     * @notice Emitted when a game with the specified ID has expired
     * @param id The unique identifier of the expired game
     */
    event GameExpired(uint256 id);

    /**
     * @notice Custom error to indicate that the game has not yet expired
     */
    error NoExpire();

    /**
     * @notice Allows an external account to cancel an expired game with the given ID
     * @dev The implementation of this function should handle game expiration logic, such as refunding players or updating game status.
     *
     * Emits a {GameExpired} event.
     *
     * @param id_ The unique identifier of the expired game to be cancelled
     */
    function cancelExpiredGame(uint256 id_) external;

    /**
     * @notice Fulfills the random number request for the game with the specified ID
     * @dev The implementation of this function should handle random number fulfillment, such as updating game state or determining winners.
     * @param id_ The unique identifier of the game for which the random number is requested
     * @param randomWords_ An array of random numer that will be used to generate winner
     */
    function fullFillRandomNumber(
        uint256 id_,
        uint256[] memory randomWords_
    ) external;
}
