// SPDX-License-Identifier: MIT
pragma solidity 0.8.19;

import "@openzeppelin/contracts/access/Ownable.sol";
import "./interfaces/IAbstractGame.sol";

/**
 * @title AbstractGame - An abstract contract for game implementation
 * @notice This abstract contract inherits from IAbstractGame and Ownable, providing basic functionality for canceling games.
 */
abstract contract AbstractGame is IAbstractGame, Ownable {
    /**
     * @notice Cancels a game with the given ID, can only be called by the contract GamesManager
     * @dev This function is an implementation of the cancelGame function from IAbstractGame interface.
     *
     * Emits a {GameCancel} event.
     *
     * @param id_ The unique identifier of the game to be cancelled
     */
    function cancelGame(uint256 id_) external onlyOwner {
        _cancelGame(id_);
    }

    /**
     * @notice Internal function to be implemented by derived contracts for canceling a game with the given ID
     * @dev Derived contracts should implement their own game cancellation logic in this function.
     * @param id_ The unique identifier of the game to be cancelled
     */
    function _cancelGame(uint256 id_) internal virtual {}
}
