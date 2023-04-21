// SPDX-License-Identifier: MIT
pragma solidity 0.8.19;

/**
 * @title IAbstractGame - An interface for abstract game contracts
 * @notice This interface is used as a standard template for creating new game contracts. It includes a cancel game function and event.
 */
interface IAbstractGame {
    /**
     * @notice Emitted when a game with the specified ID is cancelled
     * @param id The unique identifier of the cancelled game
     */
    event GameCancel(uint256 indexed id);

    /**
     * @notice Allows an GamesManager contract to cancel a game with the given ID
     * @dev The implementation of this function should handle game cancellation logic, such as refunding players or updating game status.
     *
     * Emits a {GameCancel} event.
     *
     * @param id_ The unique identifier of the game to be cancelled
     */
    function cancelGame(uint256 id_) external;
}
