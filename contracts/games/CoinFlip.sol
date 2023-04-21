// SPDX-License-Identifier: MIT
pragma solidity 0.8.19;

import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/utils/Address.sol";
import "@openzeppelin/contracts/utils/structs/EnumerableSet.sol";

import "../interfaces/IGamesManager.sol";
import "./interfaces/ICoinFlip.sol";
import "./abstract/RNAbstractGame.sol";

/**
 * @title CoinFlip - A coin flip game implementation
 * @notice This contract implements a coin flip game using the RNAbstractGame contract as a base.
 * @dev The contract utilizes OpenZeppelin's SafeERC20, Address, and EnumerableSet libraries.
 */
contract CoinFlip is ICoinFlip, RNAbstractGame {
    using SafeERC20 for IERC20;
    using Address for address payable;
    using EnumerableSet for EnumerableSet.UintSet;

    Game[] public games;

    mapping(address => mapping(address => uint256)) public override rewards;

    EnumerableSet.UintSet internal _activeGames;

    uint256 internal constant _RANDOM_NUMBER_COUNT = 1;

    /**
     * @notice Initializes the CoinFlip smart contract.
     * @param gamesManager_ The address of the games manager contract.
     */
    constructor(address gamesManager_) {
        _transferOwnership(gamesManager_);
    }

    /**
     * @notice Creates a new game with the specified token, bet amount, and bet type
     * @dev Emits a {GameCreated} event upon successful creation.
     * @param token_ The address of the token to be used for the bet
     * @param betAmount_ The amount of tokens to be used for the bet
     * @param bet_ The type of bet (EAGLE or TILE)
     */
    function createGame(
        address token_,
        uint256 betAmount_,
        BetType bet_
    ) external payable virtual override {
        if (bet_ == BetType.NONE || (msg.value > 0 && betAmount_ > 0)) {
            revert InvalidInputSettings();
        }

        if (token_ == address(0)) {
            betAmount_ = msg.value;
        }

        IGamesManager.TokenSetting memory tokenSetting = IGamesManager(owner())
            .getTokenSetting(address(this), token_);

        if (tokenSetting.minBetAmount > betAmount_) {
            revert InsufficientBet();
        }

        if (token_ != address(0)) {
            IERC20(token_).safeTransferFrom(
                msg.sender,
                address(this),
                betAmount_
            );
        }

        uint256 id = games.length;

        Game memory newGame;
        newGame.id = id;
        newGame.token = token_;
        newGame.prize = betAmount_;
        newGame.betA = bet_;
        newGame.playerA = msg.sender;
        newGame.fee = tokenSetting.fee;

        games.push(newGame);

        _activeGames.add(id);

        emit GameCreated(id, msg.sender, newGame);
    }

    /**
     * @notice Accepts a game with the specified ID
     * @dev Emits a {GameAccepted} event upon successful acceptance.
     * @param id_ The unique identifier of the game to be accepted
     */
    function acceptGame(uint256 id_) external payable virtual override {
        _requireCreatedStatus(id_);

        uint256 betAmount = games[id_].prize;
        address token = games[id_].token;

        if (token == address(0)) {
            if (msg.value != betAmount) {
                revert InsufficientBet();
            }
        } else {
            IERC20(token).safeTransferFrom(
                msg.sender,
                address(this),
                betAmount
            );
        }

        games[id_].status = GameStatus.ACCEPTED;

        uint256 expireTime = IGamesManager(owner()).requestRandomNumber(
            id_,
            _RANDOM_NUMBER_COUNT
        );

        games[id_].playerB = msg.sender;
        games[id_].prize = betAmount + betAmount;
        games[id_].expireTime = expireTime;

        emit GameAccepted(id_, msg.sender, expireTime);
    }

    /**
     * @notice Withdraws the specified token for the caller.
     * @param token_ The address of the token to be withdrawn.
     */
    function withdraw(address token_) external virtual override {
        uint256 balance = rewards[msg.sender][token_];
        rewards[msg.sender][token_] = 0;

        _transferTo(token_, msg.sender, balance);

        emit Withdraw(msg.sender, token_, balance);
    }

    /**
     * @notice Quits the game with the specified ID.
     * @param id_ The ID of the game to be quit.
     */
    function quit(uint256 id_) external virtual {
        _requireCreatedStatus(id_);

        if (games[id_].playerA != msg.sender) {
            revert AccessDenied();
        }

        games[id_].status = GameStatus.CANCELED;

        _activeGames.remove(id_);

        _transferTo(games[id_].token, msg.sender, games[id_].prize);

        emit GameCancel(id_);
    }

    /**
     * @notice Cancels an expired game by providing the game ID.
     * @param id_ The ID of the game to be canceled.
     */
    function cancelExpiredGame(uint256 id_) external virtual override {
        _requireAcceptedStatus(id_);

        if (games[id_].expireTime > block.timestamp) {
            revert NoExpire();
        }

        _cancelGame(id_);

        emit GameExpired(id_);
    }

    /**
     * @notice Lists all games with pagination.
     * @param offset_ The offset for pagination.
     * @param limit_ The limit for pagination.
     * @return totalCount The total number of games.
     * @return arr An array of games.
     */
    function list(
        uint256 offset_,
        uint256 limit_
    ) external view override returns (uint256 totalCount, Game[] memory arr) {
        totalCount = games.length;
        uint256 to = offset_ + limit_ < totalCount
            ? offset_ + limit_
            : totalCount;
        to = to > offset_ ? to : offset_;

        arr = new Game[](to - offset_);

        for (uint256 i = offset_; i < to; i++) {
            arr[i - offset_] = games[i];
        }
    }

    /**
     * @notice Lists active games with pagination.
     * @param offset_ The offset for pagination.
     * @param limit_ The limit for pagination.
     * @return totalCount The total number of active games.
     * @return arr An array of active games.
     */
    function listActive(
        uint256 offset_,
        uint256 limit_
    ) external view override returns (uint256 totalCount, Game[] memory arr) {
        totalCount = _activeGames.length();
        uint256 to = offset_ + limit_ < totalCount
            ? offset_ + limit_
            : totalCount;
        to = to > offset_ ? to : offset_;

        arr = new Game[](to - offset_);

        for (uint256 i = offset_; i < to; i++) {
            arr[i - offset_] = games[_activeGames.at(i)];
        }
    }

    /**
     * @notice Internal function
     * @notice Internal function to fulfill the random number for the specified game ID.
     * @dev Overrides the _fullFillRandomNumber function from RNAbstractGame.
     * @param id_ The ID of the game to fulfill the random number for.
     * @param randomWords_ An array containing the random words (numbers) for the game.
     */
    function _fullFillRandomNumber(
        uint256 id_,
        uint256[] memory randomWords_
    ) internal virtual override {
        _requireAcceptedStatus(id_);

        games[id_].status = GameStatus.FINISHED;

        _activeGames.remove(id_);

        BetType winBet = BetType((randomWords_[0] % 2) + 1);

        games[id_].winBet = winBet;

        address winner = winBet == games[id_].betA
            ? games[id_].playerA
            : games[id_].playerB;

        uint256 prize = games[id_].prize;
        uint256 feeAmount = (games[id_].fee * prize) / FEE_100;

        prize -= feeAmount;
        rewards[winner][games[id_].token] += prize;

        _transferTo(games[id_].token, owner(), feeAmount);

        emit GameFinished(id_, winner, winBet, prize, feeAmount);
    }

    /**
     * @notice Internal function to cancel the specified game.
     * @dev Overrides the _cancelGame function from {RNAbstractGame}.
     * @param id_ The ID of the game to be canceled.
     */
    function _cancelGame(uint256 id_) internal virtual override {
        _requireAcceptedStatus(id_);

        games[id_].status = GameStatus.CANCELED;

        _activeGames.remove(id_);

        address token = games[id_].token;
        uint256 prize = games[id_].prize;
        uint256 bet = prize / 2;

        rewards[games[id_].playerA][token] = bet;
        rewards[games[id_].playerB][token] = prize - bet;

        emit GameCancel(id_);
    }

    /**
     * @notice Internal function to transfer the specified amount of the given token to the given address.
     * @param token_ The address of the token to be transferred.
     * @param to_ The address of the recipient.
     * @param amount_ The amount of the token to be transferred.
     */
    function _transferTo(
        address token_,
        address to_,
        uint256 amount_
    ) internal virtual {
        if (token_ == address(0)) {
            payable(to_).sendValue(amount_);
        } else {
            IERC20(token_).safeTransfer(to_, amount_);
        }
    }

    /**
     * @notice Internal function to require that the specified game has a {CREATED} status.
     * @param id_ The ID of the game to check the status for.
     */
    function _requireCreatedStatus(uint256 id_) internal view virtual {
        if (games[id_].status != GameStatus.CREATED) {
            revert IncorrectGameStatus();
        }
    }

    /**
     * @notice Internal function to require that the specified game has an {ACCEPTED} status.
     * @param id_ The ID of the game to check the status for.
     */
    function _requireAcceptedStatus(uint256 id_) internal view virtual {
        if (games[id_].status != GameStatus.ACCEPTED) {
            revert IncorrectGameStatus();
        }
    }
}
