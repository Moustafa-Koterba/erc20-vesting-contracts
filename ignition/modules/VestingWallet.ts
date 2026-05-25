import { buildModule } from "@nomicfoundation/hardhat-ignition/modules";
import TokenModule from "./Token";

const VestingWalletModule = buildModule("VestingWalletModule", (m) => {
  const beneficiary = m.getParameter("beneficiary");
  const totalAmount = m.getParameter("totalAmount");
  const cliffDays = m.getParameter("cliffDays");
  const durationDays = m.getParameter("durationDays");

  const { token } = m.useModule(TokenModule);

  // Step 1 — deploy vesting wallet (no transferFrom in constructor anymore)
  const vestingWallet = m.contract("VestingWallet", [
    token,
    beneficiary,
    totalAmount,
    cliffDays,
    durationDays,
  ]);

  // Step 2 — approve vesting wallet to pull tokens
  const approval = m.call(token, "approve", [vestingWallet, totalAmount], {
    id: "approveVestingWallet",
    after: [vestingWallet],
  });

  // Step 3 — fund the vesting wallet
  m.call(vestingWallet, "fund", [], {
    id: "fundVestingWallet",
    after: [approval],
  });

  return { token, vestingWallet };
});

export default VestingWalletModule;
