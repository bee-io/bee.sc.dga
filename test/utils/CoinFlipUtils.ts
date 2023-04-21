import { BigNumber } from "ethers";
import { ICoinFlip } from "../../typechain-types";
import exp from "constants";
enum GameStatus {
  CREATED,
  ACCEPTED,
  CANCELED,
  FINISHED,
}
enum BetType {
  NONE,
  EAGLE,
  TILE,
}

export type GameStructure = {
  token: string;
  prize: BigNumber;
  fee: BigNumber;
  playerA: string;
  playerB: string;
  betA: number;
  winBet: number;
  status: number;
  expireTime: BigNumber;
};

export default { BetType, GameStatus };
