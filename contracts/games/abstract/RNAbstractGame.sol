// SPDX-License-Identifier: MIT
pragma solidity 0.8.19;

import "./interfaces/IRNAbstractGame.sol";
import "./AbstractGame.sol";

/**
 * @title RNAbstractGame - An abstract contract for game implementation with random number features
 * @notice This abstract contract inherits from IRNAbstractGame and AbstractGame, providing basic functionality for random number generation and canceling expired games.
 */
abstract contract RNAbstractGame is IRNAbstractGame, AbstractGame {
    /**
     * @notice Fulfills the random number request for the game with the specified ID, can only be called by the contract owner
     * @dev This function is an implementation of the fullFillRandomNumber function from IRNAbstractGame interface.
     * @param id_ The unique identifier of the game for which the random number is requested
     * @param randomWords_ An array of random words that will be used to generate the random number
     */
    function fullFillRandomNumber(
        uint256 id_,
        uint256[] memory randomWords_
    ) external virtual onlyOwner {
        _fullFillRandomNumber(id_, randomWords_);
    }

    /**
     * @notice Cancels an expired game with the given ID
     * @dev Derived contracts should implement their own game expiration logic in this function.
     *
     * Emits a {GameExpired} event.
     *
     * @param id_ The unique identifier of the expired game to be cancelled
     */
    function cancelExpiredGame(uint256 id_) external virtual;

    /**
     * @notice Internal function to be implemented by derived contracts for fulfilling random number requests
     * @dev Derived contracts should implement their own random number fulfillment logic in this function.
     * @param id_ The unique identifier of the game for which the random number is requested
     * @param randomWords_ An array of random words that will be used to generate the random number
     */
    function _fullFillRandomNumber(
        uint256 id_,
        uint256[] memory randomWords_
    ) internal virtual;
}
