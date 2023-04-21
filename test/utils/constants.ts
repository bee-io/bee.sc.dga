import { ethers } from "hardhat";

const One = ethers.utils.parseEther("1");
const Percentage100 = ethers.utils.parseEther("100");
const Percentage1 = One;
const Percentage15 = ethers.utils.parseEther("15");
const OneGwei = ethers.utils.parseUnits("1", 9);
const ZeroAddress = ethers.constants.AddressZero;
const Zero = ethers.constants.Zero;
const Days1 = 86400;

export const Errors = {
  ERC20: {
    InsufficientBalance: "ERC20: transfer amount exceeds balance",
    InsufficientAllowance: "insufficient allowance"
  },
  Ownable: {
    NotOwner: "Ownable: caller is not the owner"
  }
};
export default {
  Zero,
  One,
  OneGwei,
  Percentage1,
  Percentage15,
  Percentage100,
  ZeroAddress,
  Days1
};
