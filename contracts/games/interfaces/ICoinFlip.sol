// SPDX-License-Identifier: MIT
pragma solidity 0.8.19;

import "../abstract/interfaces/IRNAbstractGame.sol";

/**
 * @title ICoinFlip - Interface for a Coin Flip game contract
 * @notice This interface includes functionality specific to a coin flip game.
 */
interface ICoinFlip {
    /**
     * @notice Enum to represent the type of bet made in the game
     */
    enum BetType {
        NONE,
        EAGLE,
        TILE
    }

    /**
     * @notice Enum to represent the status of the game
     */
    enum GameStatus {
        CREATED,
        ACCEPTED,
        CANCELED,
        FINISHED
    }

    /**
     * @notice Struct to represent the state of the game
     */
    struct Game {
        uint256 id;
        address token;
        uint256 prize;
        uint256 fee;
        address playerA;
        address playerB;
        BetType betA;
        BetType winBet;
        GameStatus status;
        uint256 expireTime;
    }

    /**
     * @notice Emitted when a new game is created
     * @param id The unique identifier of the new game
     * @param playerA The address of the player who created the game
     * @param newGame The game struct containing the new game's details
     */
    event GameCreated(
        uint256 indexed id,
        address indexed playerA,
        Game newGame
    );

    /**
     * @notice Emitted when a game is accepted by a player
     * @param id The unique identifier of the accepted game
     * @param playerB The address of the player who accepted the game
     * @param expireTime The timestamp when the game expires
     */
    event GameAccepted(
        uint256 indexed id,
        address indexed playerB,
        uint256 indexed expireTime
    );

    /**
     * @notice Emitted when a game is finished
     * @param id The unique identifier of the finished game
     * @param winner The address of the winning player
     * @param winBet The type of bet that won the game
     * @param prize The total prize for the winning player
     * @param feeAmount The fee amount taken from the prize
     */
    event GameFinished(
        uint256 indexed id,
        address indexed winner,
        BetType indexed winBet,
        uint256 prize,
        uint256 feeAmount
    );

    /**
     * @notice Emitted when a withdrawal is made
     * @param sender The address of the player making the withdrawal
     * @param token The address of the token being withdrawn
     * @param balance The balance being withdrawn
     */
    event Withdraw(
        address indexed sender,
        address indexed token,
        uint256 indexed balance
    );

    /**
     * @notice Custom error for invalid input settings
     */
    error InvalidInputSettings();

    /**
     * @notice Custom error for access restriction
     */
    error AccessDenied();

    /**
     * @notice Custom error for insufficient bet amount
     */
    error InsufficientBet();

    /**
     * @notice Custom error for incorrect game status
     */
    error IncorrectGameStatus();

    /**
     * @notice Creates a new game with the specified token, bet amount, and bet type
     *
     * @param token_ The address of the token used in the game
     * @param betAmount_ The amount of the bet
     * @param bet_ The type of bet made by the player
     */
    function createGame(
        address token_,
        uint256 betAmount_,
        BetType bet_
    ) external payable;

    /**
     * @notice Accepts a game with the specified ID
     * @param id_ The unique identifier of the game to be accepted
     */
    function acceptGame(uint256 id_) external payable;

    /**
     * @notice Withdraws the specified token to the sender's address
     * @param token_ The address of the token to be withdrawn
     */
    function withdraw(address token_) external;

    /**
     * @notice Quits the game with the specified ID
     * @param id_ The unique identifier of the game to be quit
     */
    function quit(uint256 id_) external;

    /**
     * @notice Retrieves the rewards for a player in the specified token
     * @param player The address of the player
     * @param token The address of the token
     * @return The rewards of the player in the specified token
     */
    function rewards(
        address player,
        address token
    ) external view returns (uint256);

    /**
     * @notice Lists the games with the specified offset and limit
     * @param offset_ The starting point of the list
     * @param limit_ The maximum number of games to be returned
     * @return totalCount The total number of games, and arr an array of games within the specified range
     */
    function list(
        uint256 offset_,
        uint256 limit_
    ) external view returns (uint256 totalCount, Game[] memory arr);

    /**
     * @notice Lists the active games with the specified offset and limit
     * @param offset_ The starting point of the list
     * @param limit_ The maximum number of games to be returned
     * @return totalCount The total number of active games, and arr an array of active games within the specified range
     */
    function listActive(
        uint256 offset_,
        uint256 limit_
    ) external view returns (uint256 totalCount, Game[] memory arr);
}
