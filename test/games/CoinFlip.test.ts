import { ethers } from "hardhat";
import { expect } from "chai";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import {
  takeSnapshot,
  SnapshotRestorer,
  time,
} from "@nomicfoundation/hardhat-network-helpers";
import { anyValue } from "@nomicfoundation/hardhat-chai-matchers/withArgs";

import {
  CoinFlip,
  CoinFlip__factory,
  MockERC20,
  ICoinFlip,
  MockERC20__factory,
  MockGamesManager,
  MockGamesManager__factory,
} from "../../typechain-types";
import CoinFlipUtils, { GameStructure } from "../utils/CoinFlipUtils";
import constants, { Errors } from "../utils/constants";
import { BigNumber, ContractTransaction } from "ethers";

describe("CoinFlip", () => {
  let coinFlip: CoinFlip;
  let mockGamesManager: MockGamesManager;
  let token18: MockERC20;
  let token9: MockERC20;
  let anotherToken: MockERC20;
  let playerA: SignerWithAddress;
  let playerB: SignerWithAddress;
  let otherPlayer: SignerWithAddress;
  let others: SignerWithAddress[];
  let snapshot: SnapshotRestorer;

  before(async () => {
    [playerA, playerB, otherPlayer, ...others] = await ethers.getSigners();

    const mockGamesManagerFactory = (await ethers.getContractFactory(
      "MockGamesManager"
    )) as MockGamesManager__factory;
    mockGamesManager = await mockGamesManagerFactory.deploy();
    await mockGamesManager.deployed();

    const coinFlipFactory = (await ethers.getContractFactory(
      "CoinFlip"
    )) as CoinFlip__factory;
    coinFlip = await coinFlipFactory.deploy(mockGamesManager.address);
    await coinFlip.deployed();

    const erc20Factory = (await ethers.getContractFactory(
      "MockERC20"
    )) as MockERC20__factory;

    token18 = await erc20Factory.deploy("token18", "t18", 18);
    await token18.deployed();

    token9 = await erc20Factory.deploy("token9", "t9", 9);
    await token9.deployed();

    anotherToken = await erc20Factory.deploy("anotherToken", "an", 18);
    await anotherToken.deployed();

    await mockGamesManager.setGameExpireTime(coinFlip.address, constants.Days1);
    await mockGamesManager.setTokenSettings(
      coinFlip.address,
      constants.ZeroAddress,
      {
        fee: 0,
        minBetAmount: constants.One,
      }
    );
    await mockGamesManager.setTokenSettings(coinFlip.address, token18.address, {
      fee: constants.Percentage1,
      minBetAmount: constants.One,
    });

    await mockGamesManager.setTokenSettings(coinFlip.address, token9.address, {
      fee: constants.Percentage15,
      minBetAmount: constants.OneGwei,
    });

    snapshot = await takeSnapshot();
  });

  describe("deployment", async () => {
    it("Should set the right owner", async () => {
      expect(await coinFlip.owner()).to.be.equal(mockGamesManager.address);
    });
  });

  describe("createGame", () => {
    after(async () => {
      await snapshot.restore();
    });
    describe("Should fail if", async () => {
      it("user give not supported `token`", async () => {
        await expect(
          coinFlip
            .connect(playerA)
            .createGame(
              anotherToken.address,
              constants.One,
              CoinFlipUtils.BetType.EAGLE
            )
        ).to.be.reverted;
      });
      it("user give incorrect `BetType`", async () => {
        await expect(
          coinFlip
            .connect(playerA)
            .createGame(
              token18.address,
              constants.One,
              CoinFlipUtils.BetType.NONE
            )
        ).to.be.revertedWithCustomError(coinFlip, "InvalidInputSettings");
      });
      it("user give the type that goes beyond the limits", async () => {
        await expect(
          coinFlip
            .connect(playerA)
            .createGame(token18.address, constants.One, 3)
        ).to.be.reverted;
      });
      it("user try transfer `tokens` and `ETH` simultaneously", async () => {
        await expect(
          coinFlip
            .connect(playerA)
            .createGame(
              token18.address,
              constants.One,
              CoinFlipUtils.BetType.EAGLE,
              { value: constants.One }
            )
        ).to.be.revertedWithCustomError(coinFlip, "InvalidInputSettings");
      });
      it("user haven't enough ERC20 token", async () => {
        await token18.connect(playerB).approve(coinFlip.address, constants.One);
        await expect(
          coinFlip
            .connect(playerB)
            .createGame(
              token18.address,
              constants.One,
              CoinFlipUtils.BetType.EAGLE
            )
        ).to.be.revertedWith(Errors.ERC20.InsufficientBalance);
      });
      it("user give less then `minAmount`", async () => {
        await expect(
          coinFlip
            .connect(playerA)
            .createGame(
              token18.address,
              constants.One.sub(1),
              CoinFlipUtils.BetType.EAGLE
            )
        ).to.be.revertedWithCustomError(coinFlip, "InsufficientBet");
        await expect(
          coinFlip
            .connect(playerA)
            .createGame(
              constants.ZeroAddress,
              constants.Zero,
              CoinFlipUtils.BetType.EAGLE,
              { value: constants.One.sub(1) }
            )
        ).to.be.revertedWithCustomError(coinFlip, "InsufficientBet");
      });
    });
    describe("Should success create game for ETH and", async () => {
      let tx: any;
      let balancePlayerABefore = constants.Zero;
      let gameBetAmount = constants.One.add(constants.One);

      before(async () => {
        balancePlayerABefore = await ethers.provider.getBalance(
          playerA.address
        );

        tx = await coinFlip
          .connect(playerA)
          .createGame(
            constants.ZeroAddress,
            constants.Zero,
            CoinFlipUtils.BetType.EAGLE,
            { value: gameBetAmount }
          );
      });

      it("set games configuration corectly", async () => {
        let game = await coinFlip.games(0);
        expect(game.id).to.be.equal(0);
        expect(game.betA).to.be.equal(CoinFlipUtils.BetType.EAGLE);
        expect(game.playerA).to.be.equal(playerA.address);
        expect(game.playerB).to.be.equal(constants.ZeroAddress);
        expect(game.winBet).to.be.equal(CoinFlipUtils.BetType.NONE);
        expect(game.prize).to.be.equal(gameBetAmount);
        expect(game.token).to.be.equal(constants.ZeroAddress);
        expect(game.fee).to.be.equal(constants.Zero);
        expect(game.status).to.be.equal(CoinFlipUtils.GameStatus.CREATED);
        expect(game.expireTime).to.be.equal(0);
      });
      it("transfer ETH", async () => {
        const resp = await tx.wait();
        const gasUsed = resp.gasUsed;
        const gasPrice = tx.gasPrice;
        const gasCost = gasUsed.mul(gasPrice);
        let balanceAfter = balancePlayerABefore.sub(gasCost).sub(gameBetAmount);
        expect(await ethers.provider.getBalance(playerA.address)).to.be.equal(
          balanceAfter
        );
      });
      it("emit event", async () => {
        await expect(tx)
          .to.be.emit(coinFlip, "GameCreated")
          .withArgs(0, playerA.address, anyValue);
      });
    });
    describe("Should success create game for ERC20 token and emit event", async () => {
      let tx: any;
      let balancePlayerBBefore = constants.Zero;
      let gameBetAmount = ethers.utils.parseEther("100");

      before(async () => {
        await token18.mint(playerB.address, gameBetAmount);

        balancePlayerBBefore = await token18.balanceOf(playerB.address);
        await token18.connect(playerB).approve(coinFlip.address, gameBetAmount);
        tx = await coinFlip
          .connect(playerB)
          .createGame(
            token18.address,
            gameBetAmount,
            CoinFlipUtils.BetType.TILE
          );
      });

      after(async () => {
        await snapshot.restore();
      });

      it("set games configuration corectly", async () => {
        let game = await coinFlip.games(1);
        expect(game.id).to.be.equal(1);
        expect(game.betA).to.be.equal(CoinFlipUtils.BetType.TILE);
        expect(game.playerA).to.be.equal(playerB.address);
        expect(game.playerB).to.be.equal(constants.ZeroAddress);
        expect(game.winBet).to.be.equal(CoinFlipUtils.BetType.NONE);
        expect(game.prize).to.be.equal(gameBetAmount);
        expect(game.token).to.be.equal(token18.address);
        expect(game.fee).to.be.equal(constants.Percentage1);
        expect(game.status).to.be.equal(CoinFlipUtils.GameStatus.CREATED);
        expect(game.expireTime).to.be.equal(0);
      });
      it("transfer ERC20", async () => {
        let balanceAfter = balancePlayerBBefore.sub(gameBetAmount);
        expect(await token18.balanceOf(playerB.address)).to.be.equal(
          balanceAfter
        );
      });
      it("emit event", async () => {
        await expect(tx)
          .to.be.emit(coinFlip, "GameCreated")
          .withArgs(1, playerB.address, anyValue);
      });
    });
  });

  describe("quit", () => {
    afterEach(async () => {
      await snapshot.restore();
    });
    it("Fail if caller is not creator of Game", async () => {
      let gameBetAmount = ethers.utils.parseEther("100");
      await token18.mint(playerA.address, gameBetAmount);

      await token18.connect(playerA).approve(coinFlip.address, gameBetAmount);
      await coinFlip
        .connect(playerA)
        .createGame(token18.address, gameBetAmount, CoinFlipUtils.BetType.TILE);

      await expect(
        coinFlip.connect(playerB).quit(0)
      ).to.be.revertedWithCustomError(coinFlip, "AccessDenied");
    });
    it("Fail if game is accepted before quit", async () => {
      let gameBetAmount = ethers.utils.parseEther("100");

      await token18.mint(playerA.address, gameBetAmount);
      await token18.connect(playerA).approve(coinFlip.address, gameBetAmount);

      await coinFlip
        .connect(playerA)
        .createGame(token18.address, gameBetAmount, CoinFlipUtils.BetType.TILE);

      await token18.mint(playerB.address, gameBetAmount);
      await token18.connect(playerB).approve(coinFlip.address, gameBetAmount);

      await coinFlip.connect(playerB).acceptGame(0);

      await expect(
        coinFlip.connect(playerA).quit(0)
      ).to.be.revertedWithCustomError(coinFlip, "IncorrectGameStatus");
    });
    it("Fail if user try second quit time from game", async () => {
      let gameBetAmount = ethers.utils.parseEther("100");

      await token18.mint(playerA.address, gameBetAmount);
      await token18.connect(playerA).approve(coinFlip.address, gameBetAmount);

      await coinFlip
        .connect(playerA)
        .createGame(token18.address, gameBetAmount, CoinFlipUtils.BetType.TILE);

      await token18.mint(playerB.address, gameBetAmount);
      await token18.connect(playerB).approve(coinFlip.address, gameBetAmount);
      await coinFlip.connect(playerA).quit(0);

      await expect(
        coinFlip.connect(playerA).quit(0)
      ).to.be.revertedWithCustomError(coinFlip, "IncorrectGameStatus");
    });
    it("User quit from game and recive ETH back to balance", async () => {
      let gameBetAmount = ethers.utils.parseEther("100");
      let userBalanceBefore = await ethers.provider.getBalance(playerA.address);
      let tx = await coinFlip
        .connect(playerA)
        .createGame(
          constants.ZeroAddress,
          constants.Zero,
          CoinFlipUtils.BetType.TILE,
          { value: gameBetAmount }
        );
      let resp = await tx.wait();
      let gasUsed = resp.gasUsed;
      let gasPrice = tx.gasPrice;
      let gasCost = gasUsed.mul(gasPrice!);
      let balanceAfter = userBalanceBefore.sub(gasCost).sub(gameBetAmount);
      expect(await ethers.provider.getBalance(playerA.address)).to.be.equal(
        balanceAfter
      );
      tx = await coinFlip.connect(playerA).quit(0);
      resp = await tx.wait();
      gasUsed = resp.gasUsed;
      gasPrice = tx.gasPrice;
      gasCost = gasUsed.mul(gasPrice!);
      balanceAfter = balanceAfter.sub(gasCost).add(gameBetAmount);
      expect(await ethers.provider.getBalance(playerA.address)).to.be.equal(
        balanceAfter
      );
    });
    it("User quit from game and recive ERC20 back to balance", async () => {
      let gameBetAmount = ethers.utils.parseEther("100");

      await token18.mint(playerA.address, gameBetAmount);
      await token18.connect(playerA).approve(coinFlip.address, gameBetAmount);
      let userBalanceBefore = await token18.balanceOf(playerA.address);
      await coinFlip
        .connect(playerA)
        .createGame(token18.address, gameBetAmount, CoinFlipUtils.BetType.TILE);

      expect(await token18.balanceOf(playerA.address)).to.be.equal(
        userBalanceBefore.sub(gameBetAmount)
      );

      await expect(coinFlip.connect(playerA).quit(0))
        .to.be.emit(coinFlip, "GameCancel")
        .withArgs(0);

      expect(await token18.balanceOf(playerA.address)).to.be.equal(
        userBalanceBefore
      );
      let game = await coinFlip.games(0);
      expect(game.status).to.be.equal(CoinFlipUtils.GameStatus.CANCELED);
    });
  });
  describe("acceptGame", () => {
    after(async () => {
      await snapshot.restore();
    });
    describe("Should fail if", async () => {
      it("game not created", async () => {
        await expect(coinFlip.connect(playerA).acceptGame(0)).to.be.reverted;
      });
      it("game already have second player or finished", async () => {
        await coinFlip
          .connect(playerA)
          .createGame(
            constants.ZeroAddress,
            constants.Zero,
            CoinFlipUtils.BetType.EAGLE,
            { value: constants.One }
          );
        await coinFlip.connect(playerB).acceptGame(0, { value: constants.One });

        await expect(
          coinFlip.connect(otherPlayer).acceptGame(0, { value: constants.One })
        ).to.be.revertedWithCustomError(coinFlip, "IncorrectGameStatus");
      });
      it("player B give betAmount not equal of player A bet amount in ETH", async () => {
        let gameIndex = 1;
        await coinFlip
          .connect(playerA)
          .createGame(
            constants.ZeroAddress,
            constants.Zero,
            CoinFlipUtils.BetType.EAGLE,
            { value: constants.One }
          );
        await expect(
          coinFlip
            .connect(playerB)
            .acceptGame(gameIndex, { value: constants.One.add(1) })
        ).to.be.revertedWithCustomError(coinFlip, "InsufficientBet");
      });
      it("user haven't enough ERC20 token", async () => {
        let gameIndex = 2;
        await token18.mint(playerA.address, constants.One);
        await token18.connect(playerA).approve(coinFlip.address, constants.One);
        await coinFlip
          .connect(playerA)
          .createGame(
            token18.address,
            constants.One,
            CoinFlipUtils.BetType.EAGLE
          );
        await token18.connect(playerB).approve(coinFlip.address, constants.One);
        await expect(
          coinFlip.connect(playerB).acceptGame(gameIndex)
        ).to.be.revertedWith(Errors.ERC20.InsufficientBalance);
      });
    });
    describe("Should success accept game for ERC20 token18", async () => {
      let gameIndex;
      let tx: ContractTransaction;
      let betAmount = constants.One.mul(100);
      let playerABalanceBefore: BigNumber;
      let playerBBalanceBefore: BigNumber;
      let balanceCoinFlipBefore: BigNumber;
      let expireTime: number;

      before(async () => {
        await snapshot.restore();

        gameIndex = 0;
        await token18.mint(playerA.address, betAmount.mul(2));
        await token18.mint(playerB.address, betAmount);
        await token18
          .connect(playerA)
          .approve(coinFlip.address, betAmount.mul(100));
        await token18
          .connect(playerB)
          .approve(coinFlip.address, betAmount.mul(100));

        playerABalanceBefore = await token18.balanceOf(playerA.address);
        playerBBalanceBefore = await token18.balanceOf(playerB.address);
        balanceCoinFlipBefore = await token18.balanceOf(coinFlip.address);

        await coinFlip
          .connect(playerB)
          .createGame(token18.address, betAmount, CoinFlipUtils.BetType.TILE);

        tx = await coinFlip.connect(playerA).acceptGame(gameIndex);
        expireTime = (await time.latest()) + constants.Days1;
      });
      it("correct emit event", async () => {
        await expect(tx)
          .to.be.emit(coinFlip, "GameAccepted")
          .withArgs(0, playerA.address, expireTime);
        expect(await token18.balanceOf(playerA.address)).to.be.equal(
          playerABalanceBefore.sub(betAmount)
        );
        expect(await token18.balanceOf(playerB.address)).to.be.equal(
          playerBBalanceBefore.sub(betAmount)
        );
      });
      it("correct transfer ERC20", async () => {
        expect(await token18.balanceOf(playerA.address)).to.be.equal(
          playerABalanceBefore.sub(betAmount)
        );
        expect(await token18.balanceOf(playerB.address)).to.be.equal(
          playerBBalanceBefore.sub(betAmount)
        );

        expect(await token18.balanceOf(coinFlip.address)).to.be.equal(
          balanceCoinFlipBefore.add(betAmount.mul(2))
        );
      });
      it("correct update game data ", async () => {
        let game = await coinFlip.games(0);
        expect(game.id).to.be.equal(0);
        expect(game.betA).to.be.equal(CoinFlipUtils.BetType.TILE);
        expect(game.playerA).to.be.equal(playerB.address);
        expect(game.playerB).to.be.equal(playerA.address);
        expect(game.winBet).to.be.equal(CoinFlipUtils.BetType.NONE);
        expect(game.prize).to.be.equal(betAmount.mul(2));
        expect(game.token).to.be.equal(token18.address);
        expect(game.fee).to.be.equal(constants.Percentage1);
        expect(game.status).to.be.equal(CoinFlipUtils.GameStatus.ACCEPTED);
        expect(game.expireTime).to.be.equal(expireTime);
      });
    });
    describe("Should success accept game for ETH", async () => {
      let gameIndex;
      let tx: ContractTransaction;
      let betAmount = constants.One.mul(50);
      let playerABalanceBefore: BigNumber;
      let playerBBalanceBefore: BigNumber;
      let balanceCoinFlipBefore: BigNumber;
      let createTxCost: BigNumber;
      let acceptTxCost: BigNumber;
      let expireTime: number;

      before(async () => {
        await snapshot.restore();

        gameIndex = 0;
        balanceCoinFlipBefore = await ethers.provider.getBalance(
          coinFlip.address
        );
        playerABalanceBefore = await ethers.provider.getBalance(
          playerA.address
        );
        playerBBalanceBefore = await ethers.provider.getBalance(
          playerB.address
        );

        tx = await coinFlip
          .connect(playerA)
          .createGame(
            constants.ZeroAddress,
            constants.Zero,
            CoinFlipUtils.BetType.EAGLE,
            { value: betAmount }
          );

        let resp = await tx.wait();
        createTxCost = resp.gasUsed.mul(tx.gasPrice!);

        tx = await coinFlip
          .connect(playerB)
          .acceptGame(gameIndex, { value: betAmount });
        expireTime = (await time.latest()) + constants.Days1;

        resp = await tx.wait();
        acceptTxCost = resp.gasUsed.mul(tx.gasPrice!);
      });
      it("correct emit event", async () => {
        await expect(tx)
          .to.be.emit(coinFlip, "GameAccepted")
          .withArgs(0, playerB.address, expireTime);
      });
      it("correct transfer ETH", async () => {
        expect(await ethers.provider.getBalance(playerA.address)).to.be.equal(
          playerABalanceBefore.sub(betAmount).sub(createTxCost)
        );
        expect(await ethers.provider.getBalance(playerB.address)).to.be.equal(
          playerBBalanceBefore.sub(betAmount).sub(acceptTxCost)
        );
        expect(await ethers.provider.getBalance(coinFlip.address)).to.be.equal(
          balanceCoinFlipBefore.add(betAmount.mul(2))
        );
      });
      it("correct update game data ", async () => {
        let game = await coinFlip.games(0);
        expect(game.id).to.be.equal(0);
        expect(game.betA).to.be.equal(CoinFlipUtils.BetType.EAGLE);
        expect(game.playerA).to.be.equal(playerA.address);
        expect(game.playerB).to.be.equal(playerB.address);
        expect(game.winBet).to.be.equal(CoinFlipUtils.BetType.NONE);
        expect(game.prize).to.be.equal(betAmount.mul(2));
        expect(game.token).to.be.equal(constants.ZeroAddress);
        expect(game.fee).to.be.equal(constants.Zero);
        expect(game.status).to.be.equal(CoinFlipUtils.GameStatus.ACCEPTED);
        expect(game.expireTime).to.be.equal(expireTime);
      });
    });
  });
  describe("cancelExpiredGame", () => {
    let gameIndex: number;
    let betAmount: BigNumber;
    let expireTime: number;

    before(async () => {
      betAmount = constants.One.mul(100);
      gameIndex = 0;
      await token18.mint(playerA.address, betAmount);
      await token18.mint(playerB.address, betAmount);
      await token18.connect(playerA).approve(coinFlip.address, betAmount);
      await token18.connect(playerB).approve(coinFlip.address, betAmount);

      await coinFlip
        .connect(playerA)
        .createGame(token18.address, betAmount, CoinFlipUtils.BetType.EAGLE);

      await coinFlip.connect(playerB).acceptGame(gameIndex);
      expireTime = (await time.latest()) + constants.Days1;
    });
    describe("Should fail if", async () => {
      it("try call for not Accepted game", async () => {
        await token9.mint(playerA.address, betAmount);
        await token9.connect(playerA).approve(coinFlip.address, betAmount);
        await coinFlip
          .connect(playerA)
          .createGame(token9.address, betAmount, CoinFlipUtils.BetType.EAGLE);
        await expect(
          coinFlip.connect(playerA).cancelExpiredGame(gameIndex + 1)
        ).to.be.revertedWithCustomError(coinFlip, "IncorrectGameStatus");
      });
      it("try call when no expire", async () => {
        await expect(
          coinFlip.connect(playerA).cancelExpiredGame(gameIndex)
        ).to.be.revertedWithCustomError(coinFlip, "NoExpire");
      });
    });
    describe("Should success expired game", async () => {
      let tx: ContractTransaction;
      let playerARewardsBefore: BigNumber;
      let playerBRewardsBefore: BigNumber;

      before(async () => {
        playerARewardsBefore = await coinFlip.rewards(
          playerA.address,
          token18.address
        );
        playerBRewardsBefore = await coinFlip.rewards(
          playerB.address,
          token18.address
        );

        time.increase(constants.Days1);
        tx = await coinFlip.connect(playerA).cancelExpiredGame(gameIndex);
      });
      it("correct emit event", async () => {
        await expect(tx).to.be.emit(coinFlip, "GameExpired").withArgs(0);
        await expect(tx).to.be.emit(coinFlip, "GameCancel").withArgs(0);
      });
      it("correct set rewards for user after expired", async () => {
        expect(
          await coinFlip.rewards(playerA.address, token18.address)
        ).to.be.equal(playerARewardsBefore.add(betAmount));
        expect(
          await coinFlip.rewards(playerB.address, token18.address)
        ).to.be.equal(playerBRewardsBefore.add(betAmount));
      });
      it("correct update game data ", async () => {
        let game = await coinFlip.games(0);
        expect(game.id).to.be.equal(0);
        expect(game.betA).to.be.equal(CoinFlipUtils.BetType.EAGLE);
        expect(game.playerA).to.be.equal(playerA.address);
        expect(game.playerB).to.be.equal(playerB.address);
        expect(game.winBet).to.be.equal(CoinFlipUtils.BetType.NONE);
        expect(game.prize).to.be.equal(betAmount.mul(2));
        expect(game.token).to.be.equal(token18.address);
        expect(game.fee).to.be.equal(constants.Percentage1);
        expect(game.status).to.be.equal(CoinFlipUtils.GameStatus.CANCELED);
        expect(game.expireTime).to.be.equal(expireTime);
      });
    });
  });
  describe("cancelGame", () => {
    let gameIndex: number;
    let betAmount: BigNumber;

    before(async () => {
      await snapshot.restore();

      betAmount = constants.One.mul(100);
      gameIndex = 0;
      await token18.mint(playerA.address, betAmount);
      await token18.mint(playerB.address, betAmount);
      await token18.connect(playerA).approve(coinFlip.address, betAmount);
      await token18.connect(playerB).approve(coinFlip.address, betAmount);

      await coinFlip
        .connect(playerA)
        .createGame(token18.address, betAmount, CoinFlipUtils.BetType.EAGLE);

      await coinFlip.connect(playerB).acceptGame(gameIndex);
    });
    describe("Should fail if", async () => {
      it("try call from not GamesManager", async () => {
        await expect(
          coinFlip.connect(playerA).cancelGame(gameIndex)
        ).to.be.revertedWith(Errors.Ownable.NotOwner);
      });
      it("try call for non accepted game or finished/canceled", async () => {
        await coinFlip
          .connect(playerA)
          .createGame(
            constants.ZeroAddress,
            constants.Zero,
            CoinFlipUtils.BetType.EAGLE,
            { value: constants.One }
          );

        await expect(
          mockGamesManager.cancelGame(coinFlip.address, gameIndex + 1)
        ).to.be.revertedWithCustomError(coinFlip, "IncorrectGameStatus");
        await coinFlip.connect(playerA).quit(gameIndex + 1);
        await expect(
          mockGamesManager.cancelGame(coinFlip.address, gameIndex + 1)
        ).to.be.revertedWithCustomError(coinFlip, "IncorrectGameStatus");
      });
    });
    describe("Should success cancel game", async () => {
      let tx: ContractTransaction;
      let playerARewardsBefore: BigNumber;
      let playerBRewardsBefore: BigNumber;

      before(async () => {
        playerARewardsBefore = await coinFlip.rewards(
          playerA.address,
          token18.address
        );
        playerBRewardsBefore = await coinFlip.rewards(
          playerB.address,
          token18.address
        );
        tx = await mockGamesManager.cancelGame(coinFlip.address, gameIndex);
      });
      it("correct emit event", async () => {
        await expect(tx).to.be.emit(coinFlip, "GameCancel").withArgs(gameIndex);
      });
      it("correct set rewards for user after cancel", async () => {
        expect(
          await coinFlip.rewards(playerA.address, token18.address)
        ).to.be.equal(playerARewardsBefore.add(betAmount));
        expect(
          await coinFlip.rewards(playerB.address, token18.address)
        ).to.be.equal(playerBRewardsBefore.add(betAmount));
      });
      it("correct update game data ", async () => {
        let game = await coinFlip.games(gameIndex);
        expect(game.id).to.be.equal(gameIndex);
        expect(game.betA).to.be.equal(CoinFlipUtils.BetType.EAGLE);
        expect(game.playerA).to.be.equal(playerA.address);
        expect(game.playerB).to.be.equal(playerB.address);
        expect(game.winBet).to.be.equal(CoinFlipUtils.BetType.NONE);
        expect(game.prize).to.be.equal(betAmount.mul(2));
        expect(game.token).to.be.equal(token18.address);
        expect(game.fee).to.be.equal(constants.Percentage1);
        expect(game.status).to.be.equal(CoinFlipUtils.GameStatus.CANCELED);
      });
    });
  });
  describe("game finishing", () => {
    describe("token18", async () => {
      let gameIndex: number;
      let betAmount: BigNumber;

      before(async () => {
        await snapshot.restore();

        betAmount = constants.One.mul(100);
        gameIndex = 0;
        await token18.mint(playerA.address, betAmount);
        await token18.mint(playerB.address, betAmount);
        await token18.connect(playerA).approve(coinFlip.address, betAmount);
        await token18.connect(playerB).approve(coinFlip.address, betAmount);

        await coinFlip
          .connect(playerA)
          .createGame(token18.address, betAmount, CoinFlipUtils.BetType.EAGLE);

        await coinFlip.connect(playerB).acceptGame(gameIndex);
      });
      describe("Should fail if", async () => {
        it("try provide random number from not GamesManager", async () => {
          await expect(
            coinFlip.connect(playerA).fullFillRandomNumber(gameIndex, [1])
          ).to.be.revertedWith(Errors.Ownable.NotOwner);
        });
        it("try call for non accepted game or finished/canceled", async () => {
          await coinFlip
            .connect(playerA)
            .createGame(
              constants.ZeroAddress,
              constants.Zero,
              CoinFlipUtils.BetType.EAGLE,
              { value: constants.One }
            );

          await expect(
            mockGamesManager.fullFillRandomNumber(
              coinFlip.address,
              gameIndex + 1,
              [1]
            )
          ).to.be.revertedWithCustomError(coinFlip, "IncorrectGameStatus");
          await coinFlip.connect(playerA).quit(gameIndex + 1);
          await expect(
            mockGamesManager.fullFillRandomNumber(
              coinFlip.address,
              gameIndex + 1,
              [1]
            )
          ).to.be.revertedWithCustomError(coinFlip, "IncorrectGameStatus");
        });
      });
      describe("Should success provide random number for calculate winner", async () => {
        let tx: ContractTransaction;
        let playerARewardsBefore: BigNumber;
        let playerBRewardsBefore: BigNumber;
        let gamesManagerBalanceBefore: BigNumber;
        let fee: BigNumber;
        let prize: BigNumber;
        before(async () => {
          playerARewardsBefore = await coinFlip.rewards(
            playerA.address,
            token18.address
          );
          playerBRewardsBefore = await coinFlip.rewards(
            playerB.address,
            token18.address
          );
          gamesManagerBalanceBefore = await token18.balanceOf(
            mockGamesManager.address
          );
          expect(await token18.balanceOf(mockGamesManager.address)).to.be.equal(
            constants.Zero
          );
          tx = await mockGamesManager.fullFillRandomNumber(
            coinFlip.address,
            gameIndex,
            [CoinFlipUtils.BetType.EAGLE - 1]
          );

          prize = betAmount.mul(2);
          fee = prize.mul(constants.Percentage1).div(constants.Percentage100);
          prize = prize.sub(fee);
        });
        it("emit event", async () => {
          await expect(tx)
            .to.be.emit(coinFlip, "GameFinished")
            .withArgs(
              gameIndex,
              playerA.address,
              CoinFlipUtils.BetType.EAGLE,
              prize,
              fee
            );
        });
        it("set rewards for user after calcualte winner", async () => {
          expect(
            await coinFlip.rewards(playerA.address, token18.address)
          ).to.be.equal(playerARewardsBefore.add(prize));
          expect(
            await coinFlip.rewards(playerB.address, token18.address)
          ).to.be.equal(playerBRewardsBefore);
        });
        it("update game data ", async () => {
          let game = await coinFlip.games(gameIndex);

          expect(game.id).to.be.equal(gameIndex);
          expect(game.betA).to.be.equal(CoinFlipUtils.BetType.EAGLE);
          expect(game.playerA).to.be.equal(playerA.address);
          expect(game.playerB).to.be.equal(playerB.address);
          expect(game.winBet).to.be.equal(CoinFlipUtils.BetType.EAGLE);
          expect(game.prize).to.be.equal(betAmount.mul(2));
          expect(game.token).to.be.equal(token18.address);
          expect(game.fee).to.be.equal(constants.Percentage1);
          expect(game.status).to.be.equal(CoinFlipUtils.GameStatus.FINISHED);
        });
        it("transfer fee", async () => {
          expect(await token18.balanceOf(mockGamesManager.address)).to.be.equal(
            gamesManagerBalanceBefore.add(fee)
          );
        });
      });
    });
  });

  describe("list & listActive", async () => {
    before(async () => {
      await snapshot.restore();
    });
    it("return empty list & listActive if games array is empty", async () => {
      let result = await coinFlip.list(0, 100);
      expect(result.totalCount).to.be.equal(constants.Zero);
      expect(result.arr).to.have.lengthOf(0);
      expect(result.arr).to.be.a("array");

      let resultActive = await coinFlip.listActive(0, 100);
      expect(resultActive.totalCount).to.be.equal(constants.Zero);
      expect(resultActive.arr).to.have.lengthOf(0);
      expect(resultActive.arr).to.be.a("array");
    });
    it("return one element when call list & listActive if games containes 1 active games", async () => {
      await coinFlip
        .connect(playerA)
        .createGame(
          constants.ZeroAddress,
          constants.Zero,
          CoinFlipUtils.BetType.EAGLE,
          { value: constants.One }
        );

      let result = await coinFlip.list(0, 100);
      expect(result.totalCount).to.be.equal(1);
      expect(result.arr).to.have.lengthOf(1);
      expect(result.arr).to.be.a("array");
      expect(result.arr[0].id).to.be.equal(0);

      let resultActive = await coinFlip.listActive(0, 100);
      expect(resultActive.totalCount).to.be.equal(1);
      expect(resultActive.arr).to.have.lengthOf(1);
      expect(resultActive.arr).to.be.a("array");
      expect(resultActive.arr[0].id).to.be.equal(0);
    });
    it("return 5 element when call list & listActive if games containes 5 active games", async () => {
      await coinFlip
        .connect(playerA)
        .createGame(
          constants.ZeroAddress,
          constants.Zero,
          CoinFlipUtils.BetType.EAGLE,
          { value: constants.One }
        );
      await coinFlip
        .connect(playerA)
        .createGame(
          constants.ZeroAddress,
          constants.Zero,
          CoinFlipUtils.BetType.EAGLE,
          { value: constants.One }
        );
      await coinFlip
        .connect(playerA)
        .createGame(
          constants.ZeroAddress,
          constants.Zero,
          CoinFlipUtils.BetType.EAGLE,
          { value: constants.One }
        );
      await coinFlip
        .connect(playerA)
        .createGame(
          constants.ZeroAddress,
          constants.Zero,
          CoinFlipUtils.BetType.EAGLE,
          { value: constants.One }
        );

      let result = await coinFlip.list(0, 100);
      expect(result.totalCount).to.be.equal(5);
      expect(result.arr).to.have.lengthOf(5);
      expect(result.arr).to.be.a("array");
      expect(result.arr[0].id).to.be.equal(0);
      expect(result.arr[1].id).to.be.equal(1);
      expect(result.arr[3].id).to.be.equal(3);
      expect(result.arr[4].id).to.be.equal(4);

      let resultActive = await coinFlip.listActive(0, 100);
      expect(resultActive.totalCount).to.be.equal(5);
      expect(resultActive.arr).to.have.lengthOf(5);
      expect(resultActive.arr).to.be.a("array");
      expect(resultActive.arr[0].id).to.be.equal(0);
      expect(resultActive.arr[1].id).to.be.equal(1);
      expect(resultActive.arr[3].id).to.be.equal(3);
      expect(resultActive.arr[4].id).to.be.equal(4);
    });
    it("should corectly return if offset is more then total count", async () => {
      let result = await coinFlip.list(5, 100);
      expect(result.totalCount).to.be.equal(5);
      expect(result.arr).to.have.lengthOf(0);
      expect(result.arr).to.be.a("array");

      let resultActive = await coinFlip.listActive(5, 100);
      expect(resultActive.totalCount).to.be.equal(5);
      expect(resultActive.arr).to.have.lengthOf(0);
      expect(resultActive.arr).to.be.a("array");
    });
    it("should corectly return if limit is zero", async () => {
      let result = await coinFlip.list(0, 0);
      expect(result.totalCount).to.be.equal(5);
      expect(result.arr).to.have.lengthOf(0);
      expect(result.arr).to.be.a("array");

      let resultActive = await coinFlip.listActive(0, 0);
      expect(resultActive.totalCount).to.be.equal(5);
      expect(resultActive.arr).to.have.lengthOf(0);
      expect(resultActive.arr).to.be.a("array");
    });
    it("should corectly return if offset set on 40% and limit on 20%", async () => {
      let result = await coinFlip.list(1, 1);
      expect(result.totalCount).to.be.equal(5);
      expect(result.arr).to.have.lengthOf(1);
      expect(result.arr).to.be.a("array");
      expect(result.arr[0].id).to.be.equal(1);

      let resultActive = await coinFlip.listActive(1, 1);
      expect(resultActive.totalCount).to.be.equal(5);
      expect(resultActive.arr).to.have.lengthOf(1);
      expect(resultActive.arr).to.be.a("array");
      expect(resultActive.arr[0].id).to.be.equal(1);
    });
    it("should corectly return list when one game will cancele", async () => {
      await coinFlip.connect(playerA).quit(0);

      let result = await coinFlip.list(0, 100);
      expect(result.totalCount).to.be.equal(5);
      expect(result.arr).to.have.lengthOf(5);
      expect(result.arr).to.be.a("array");
      expect(result.arr[0].id).to.be.equal(0);
      expect(result.arr[1].id).to.be.equal(1);
      expect(result.arr[2].id).to.be.equal(2);
      expect(result.arr[3].id).to.be.equal(3);
      expect(result.arr[4].id).to.be.equal(4);

      let resultActive = await coinFlip.listActive(0, 100);
      expect(resultActive.totalCount).to.be.equal(4);
      expect(resultActive.arr).to.have.lengthOf(4);
      expect(resultActive.arr).to.be.a("array");
      expect(resultActive.arr[0].id).to.be.equal(4);
      expect(resultActive.arr[1].id).to.be.equal(1);
      expect(resultActive.arr[2].id).to.be.equal(2);
      expect(resultActive.arr[3].id).to.be.equal(3);
    });
    it("should corectly return list when 90% all game will cancele or finished", async () => {

      await coinFlip.connect(playerB).acceptGame(1, { value: constants.One });
      await coinFlip.connect(playerB).acceptGame(2, { value: constants.One });
      await coinFlip.connect(playerB).acceptGame(3, { value: constants.One });

      await mockGamesManager.cancelGame(coinFlip.address, 1);
      await mockGamesManager.fullFillRandomNumber(coinFlip.address, 2, [2]);
      await time.increase(constants.Days1);
      await coinFlip.cancelExpiredGame(3);

      let result = await coinFlip.list(0, 100);
      expect(result.totalCount).to.be.equal(5);
      expect(result.arr).to.have.lengthOf(5);
      expect(result.arr).to.be.a("array");
      expect(result.arr[0].id).to.be.equal(0);
      expect(result.arr[1].id).to.be.equal(1);
      expect(result.arr[2].id).to.be.equal(2);
      expect(result.arr[3].id).to.be.equal(3);
      expect(result.arr[4].id).to.be.equal(4);

      let resultActive = await coinFlip.listActive(0, 100);
      expect(resultActive.totalCount).to.be.equal(1);
      expect(resultActive.arr).to.have.lengthOf(1);
      expect(resultActive.arr).to.be.a("array");
      expect(resultActive.arr[0].id).to.be.equal(4);
    });
  });
  // describe("withdraw", async () => {
  //   describe("Should success withdraw and emit event", async () => {
  //     let tx: any;
  //     let ethGameIndex = 0;
  //     let token18GameIndex = 1;
  //     let token9GameIndex = 2;
  //     let ethBalance = constants.One.mul(1000);
  //     let token18Balance = constants.One.mul(50);
  //     let token9Balance = constants.OneGwei.mul(75);

  //     before(async () => {
  //       await snapshot.restore();
  //       await token18.mint(playerA.address, token18Balance);
  //       await token18.mint(playerB.address, token18Balance);
  //       await token9.mint(playerA.address, token9Balance);
  //       await token9.mint(playerB.address, token9Balance);
  //       await token18
  //         .connect(playerA)
  //         .approve(coinFlip.address, token18Balance);
  //       await token18
  //         .connect(playerB)
  //         .approve(coinFlip.address, token18Balance);
  //       await token9.connect(playerA).approve(coinFlip.address, token9Balance);
  //       await token9.connect(playerB).approve(coinFlip.address, token9Balance);

  //       await coinFlip
  //         .connect(playerA)
  //         .createGame(
  //           constants.ZeroAddress,
  //           constants.Zero,
  //           CoinFlipUtils.BetType.EAGLE,
  //           { value: ethBalance }
  //         );
  //       await coinFlip
  //         .connect(playerA)
  //         .createGame(
  //           token18.address,
  //           token18Balance,
  //           CoinFlipUtils.BetType.EAGLE
  //         );
  //       await coinFlip
  //         .connect(playerA)
  //         .createGame(
  //           token9.address,
  //           token9Balance,
  //           CoinFlipUtils.BetType.EAGLE
  //         );
  //       await coinFlip.connect(playerB).acceptGame(ethGameIndex);
  //       await coinFlip.connect(playerB).acceptGame(token18GameIndex);
  //       await coinFlip.connect(playerB).acceptGame(token9GameIndex);
  //       await mockGamesManager.cancelGame(coinFlip.address, ethGameIndex);
  //       await mockGamesManager.cancelGame(coinFlip.address, token18GameIndex);
  //       await mockGamesManager.cancelGame(coinFlip.address, token9GameIndex);
  //     });

  //     it("Should cocrect set rewards amount after cancel 3 games", async () => {
  //       expect(
  //         await coinFlip.rewards(playerA.address, constants.ZeroAddress)
  //       ).to.be.equal(ethBalance);
  //       expect(
  //         await coinFlip.rewards(playerB.address, constants.ZeroAddress)
  //       ).to.be.equal(ethBalance);
  //       expect(
  //         await coinFlip.rewards(playerA.address, token18.address)
  //       ).to.be.equal(token18Balance);
  //       expect(
  //         await coinFlip.rewards(playerB.address, token18.address)
  //       ).to.be.equal(token18Balance);
  //       expect(
  //         await coinFlip.rewards(playerA.address, token9.address)
  //       ).to.be.equal(token9Balance);
  //       expect(
  //         await coinFlip.rewards(playerB.address, token9.address)
  //       ).to.be.equal(token9Balance);
  //     });
  //   });
  // });
});
