// SPDX-License-Identifier: MIT
pragma solidity 0.8.19;

import "../interfaces/IGamesManager.sol";
import "../games/abstract/interfaces/IRNAbstractGame.sol";

contract MockGamesManager is IGamesManager {
    mapping(address => mapping(address => TokenSetting))
        public tokensSetting;
    mapping(address => uint256) public gamesExpireTime;

    receive() external payable{
        
    }
    function setGameExpireTime(address game_, uint256 expireTime_) external {
        gamesExpireTime[game_] = expireTime_;
    }

    function setTokenSettings(
        address game,
        address token,
        TokenSetting memory setting
    ) external {
        tokensSetting[game][token] = setting;
    }

    function getTokenSetting(
        address game,
        address token
    ) external view returns (TokenSetting memory) {
        require(tokensSetting[game][token].minBetAmount > 0);
        return tokensSetting[game][token];
    }

    function requestRandomNumber(
        uint256 gameId,
        uint256 count
    ) external returns (uint256) {
        return block.timestamp + gamesExpireTime[msg.sender];
    }

    function cancelGame(address game_, uint256 id_) external {
        IRNAbstractGame(game_).cancelGame(id_);
    }

    function fullFillRandomNumber(
        address game_,
        uint256 id_,
        uint256[] memory randomWords
    ) external {
        IRNAbstractGame(game_).fullFillRandomNumber(id_, randomWords);
    }
}
