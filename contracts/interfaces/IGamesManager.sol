// SPDX-License-Identifier: MIT
pragma solidity 0.8.19;

uint256 constant FEE_100 = 100e18;

/**
 * @title IGamesManager
 * @dev Interface for the Games Manager contract to manage game settings and random number requests.
 */
interface IGamesManager {
    /**
     * @dev Represents the token settings for a game, including fee and minimum bet amount.
     */
    struct TokenSetting {
        uint256 fee;
        uint256 minBetAmount;
    }

    /**
     * @notice Get the token settings for a specific game and token.
     * @param game_ The address of the game contract.
     * @param token_ The address of the token contract.
     * @return A TokenSetting struct containing the fee and minimum bet amount for the given game and token.
     */
    function getTokenSetting(
        address game_,
        address token_
    ) external view returns (TokenSetting memory);

    /**
     * @notice Request a random number for the specified game ID.
     * @param gameId_ The ID of the game for which a random number is being requested.
     * @param count_ The number of random numbers requested.
     * @return The random number request ID.
     */
    function requestRandomNumber(
        uint256 gameId_,
        uint256 count_
    ) external returns (uint256);
}
