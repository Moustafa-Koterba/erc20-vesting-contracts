import { expect } from "chai";
import { network } from "hardhat";

const { ethers, networkHelpers } = await network.create();

const TOTAL_AMOUNT = ethers.parseUnits("200000", 18);
const CLIFF_DAYS = 365;
const DURATION_DAYS = 1460;
const CLIFF_SECONDS = BigInt(CLIFF_DAYS * 24 * 60 * 60);
const DURATION_SECONDS = BigInt(DURATION_DAYS * 24 * 60 * 60);

describe("VestingWallet", function () {
  async function deployCleanFixture() {
    const [owner, beneficiary, stranger] = await ethers.getSigners();

    const token = await ethers.deployContract("Token", [
      "Token",
      "TKN",
      1_000_000,
    ]);

    const vestingWallet = await ethers.deployContract("VestingWallet", [
      await token.getAddress(),
      beneficiary.address,
      TOTAL_AMOUNT,
      CLIFF_DAYS,
      DURATION_DAYS,
    ]);
    const deployTimestamp = await networkHelpers.time.latest();

    await token.approve(await vestingWallet.getAddress(), TOTAL_AMOUNT);

    await vestingWallet.fund();

    return {
      token,
      vestingWallet,
      owner,
      beneficiary,
      stranger,
      deployTimestamp,
    };
  }

  async function deployCleanFixtureNoFund() {
    const [owner, beneficiary, stranger] = await ethers.getSigners();

    const token = await ethers.deployContract("Token", [
      "Token",
      "TKN",
      1_000_000,
    ]);

    const vestingWallet = await ethers.deployContract("VestingWallet", [
      await token.getAddress(),
      beneficiary.address,
      TOTAL_AMOUNT,
      CLIFF_DAYS,
      DURATION_DAYS,
    ]);
    const deployTimestamp = await networkHelpers.time.latest();

    await token.approve(await vestingWallet.getAddress(), TOTAL_AMOUNT);

    return {
      token,
      vestingWallet,
      owner,
      beneficiary,
      stranger,
      deployTimestamp,
    };
  }

  describe("Deployment", function () {
    it("should set the correct token address", async function () {
      const { token, vestingWallet } = await networkHelpers.loadFixture(
        deployCleanFixture,
      );
      expect(await vestingWallet.token()).to.equal(await token.getAddress());
    });

    it("should set the correct beneficiary", async function () {
      const { vestingWallet, beneficiary } = await networkHelpers.loadFixture(
        deployCleanFixture,
      );
      expect(await vestingWallet.beneficiary()).to.equal(beneficiary.address);
    });

    it("should set the correct total amount", async function () {
      const { vestingWallet } = await networkHelpers.loadFixture(
        deployCleanFixture,
      );
      expect(await vestingWallet.totalAmount()).to.equal(TOTAL_AMOUNT);
    });

    it("should set cliff correctly", async function () {
      const { vestingWallet, deployTimestamp } =
        await networkHelpers.loadFixture(deployCleanFixture);
      const expectedCliff = BigInt(deployTimestamp) + CLIFF_SECONDS;
      expect(await vestingWallet.cliff()).to.equal(expectedCliff);
    });

    it("should set duration correctly", async function () {
      const { vestingWallet } = await networkHelpers.loadFixture(
        deployCleanFixture,
      );
      expect(await vestingWallet.duration()).to.equal(DURATION_SECONDS);
    });

    it("should hold the tokens after deployment", async function () {
      const { token, vestingWallet } = await networkHelpers.loadFixture(
        deployCleanFixture,
      );
      expect(await token.balanceOf(await vestingWallet.getAddress())).to.equal(
        TOTAL_AMOUNT,
      );
    });

    it("should start with released = 0", async function () {
      const { vestingWallet } = await networkHelpers.loadFixture(
        deployCleanFixture,
      );
      expect(await vestingWallet.released()).to.equal(0);
    });

    it("should start with revoked = false", async function () {
      const { vestingWallet } = await networkHelpers.loadFixture(
        deployCleanFixture,
      );
      expect(await vestingWallet.revoked()).to.equal(false);
    });

    it("should set the deployer as owner", async function () {
      const { vestingWallet, owner } = await networkHelpers.loadFixture(
        deployCleanFixture,
      );
      expect(await vestingWallet.owner()).to.equal(owner.address);
    });
  });

  describe("Invalid deployments", function () {
    it("should revert with zero token address", async function () {
      const [, beneficiary] = await ethers.getSigners();
      await expect(
        ethers.deployContract("VestingWallet", [
          ethers.ZeroAddress,
          beneficiary.address,
          TOTAL_AMOUNT,
          CLIFF_DAYS,
          DURATION_DAYS,
        ]),
      ).to.be.revertedWithCustomError(
        await ethers.getContractFactory("VestingWallet"),
        "ZeroAddress",
      );
    });

    it("should revert with zero beneficiary address", async function () {
      const token = await ethers.deployContract("Token", [
        "Token",
        "TKN",
        1_000_000,
      ]);
      await expect(
        ethers.deployContract("VestingWallet", [
          await token.getAddress(),
          ethers.ZeroAddress,
          TOTAL_AMOUNT,
          CLIFF_DAYS,
          DURATION_DAYS,
        ]),
      ).to.be.revertedWithCustomError(
        await ethers.getContractFactory("VestingWallet"),
        "ZeroAddress",
      );
    });

    it("should revert with zero amount", async function () {
      const [, beneficiary] = await ethers.getSigners();
      const token = await ethers.deployContract("Token", [
        "Token",
        "TKN",
        1_000_000,
      ]);
      await expect(
        ethers.deployContract("VestingWallet", [
          await token.getAddress(),
          beneficiary.address,
          0,
          CLIFF_DAYS,
          DURATION_DAYS,
        ]),
      ).to.be.revertedWithCustomError(
        await ethers.getContractFactory("VestingWallet"),
        "ZeroAmount",
      );
    });

    it("should revert when duration is shorter than cliff", async function () {
      const [, beneficiary] = await ethers.getSigners();
      const token = await ethers.deployContract("Token", [
        "Token",
        "TKN",
        1_000_000,
      ]);
      await expect(
        ethers.deployContract("VestingWallet", [
          await token.getAddress(),
          beneficiary.address,
          TOTAL_AMOUNT,
          CLIFF_DAYS,
          CLIFF_DAYS,
        ]),
      ).to.be.revertedWithCustomError(
        await ethers.getContractFactory("VestingWallet"),
        "DurationShorterThanCliff",
      );
    });
  });

  describe("vestedAmount()", function () {
    it("should return 0 before cliff", async function () {
      const { vestingWallet, deployTimestamp } =
        await networkHelpers.loadFixture(deployCleanFixture);
      await networkHelpers.time.increaseTo(
        BigInt(deployTimestamp) + CLIFF_SECONDS - 1n,
      );
      expect(await vestingWallet.vestedAmount()).to.equal(0);
    });

    it("should return 25% at exactly the cliff", async function () {
      const { vestingWallet, deployTimestamp } =
        await networkHelpers.loadFixture(deployCleanFixture);
      await networkHelpers.time.increaseTo(
        BigInt(deployTimestamp) + CLIFF_SECONDS,
      );
      const expected = (TOTAL_AMOUNT * CLIFF_SECONDS) / DURATION_SECONDS;
      expect(await vestingWallet.vestedAmount()).to.be.closeTo(
        expected,
        ethers.parseUnits("1", 18),
      );
    });

    it("should return 50% at half duration", async function () {
      const { vestingWallet, deployTimestamp } =
        await networkHelpers.loadFixture(deployCleanFixture);
      await networkHelpers.time.increaseTo(
        BigInt(deployTimestamp) + DURATION_SECONDS / 2n,
      );
      expect(await vestingWallet.vestedAmount()).to.be.closeTo(
        TOTAL_AMOUNT / 2n,
        ethers.parseUnits("1", 18),
      );
    });

    it("should return 100% at full duration", async function () {
      const { vestingWallet, deployTimestamp } =
        await networkHelpers.loadFixture(deployCleanFixture);
      await networkHelpers.time.increaseTo(
        BigInt(deployTimestamp) + DURATION_SECONDS,
      );
      expect(await vestingWallet.vestedAmount()).to.equal(TOTAL_AMOUNT);
    });

    it("should return 100% after full duration has passed", async function () {
      const { vestingWallet, deployTimestamp } =
        await networkHelpers.loadFixture(deployCleanFixture);
      await networkHelpers.time.increaseTo(
        BigInt(deployTimestamp) + DURATION_SECONDS + 1000n,
      );
      expect(await vestingWallet.vestedAmount()).to.equal(TOTAL_AMOUNT);
    });

    it("should return 0 when not funded", async function () {
      const { vestingWallet } = await networkHelpers.loadFixture(
        deployCleanFixtureNoFund,
      );

      expect(await vestingWallet.vestedAmount()).to.be.equal(0);
    });
  });

  describe("release()", function () {
    it("should revert before cliff", async function () {
      const { vestingWallet, deployTimestamp, beneficiary } =
        await networkHelpers.loadFixture(deployCleanFixture);
      await networkHelpers.time.increaseTo(
        BigInt(deployTimestamp) + CLIFF_SECONDS - 10n,
      );
      await expect(
        vestingWallet.connect(beneficiary).release(),
      ).to.be.revertedWithCustomError(vestingWallet, "CliffNotReached");
    });

    it("should revert when called by non-beneficiary", async function () {
      const { vestingWallet, deployTimestamp, stranger } =
        await networkHelpers.loadFixture(deployCleanFixture);
      await networkHelpers.time.increaseTo(
        BigInt(deployTimestamp) + CLIFF_SECONDS,
      );
      await expect(
        vestingWallet.connect(stranger).release(),
      ).to.be.revertedWithCustomError(vestingWallet, "ZeroAddress");
    });

    it("should transfer correct amount at cliff", async function () {
      const { token, vestingWallet, deployTimestamp, beneficiary } =
        await networkHelpers.loadFixture(deployCleanFixture);
      await networkHelpers.time.increaseTo(
        BigInt(deployTimestamp) + CLIFF_SECONDS,
      );
      const balanceBefore = await token.balanceOf(beneficiary.address);
      await vestingWallet.connect(beneficiary).release();
      const balanceAfter = await token.balanceOf(beneficiary.address);
      const expected = (TOTAL_AMOUNT * CLIFF_SECONDS) / DURATION_SECONDS;
      expect(balanceAfter - balanceBefore).to.be.closeTo(
        expected,
        ethers.parseUnits("1", 18),
      );
    });

    it("should update released after claiming", async function () {
      const { vestingWallet, deployTimestamp, beneficiary } =
        await networkHelpers.loadFixture(deployCleanFixture);
      await networkHelpers.time.increaseTo(
        BigInt(deployTimestamp) + CLIFF_SECONDS,
      );
      await vestingWallet.connect(beneficiary).release();
      expect(await vestingWallet.released()).to.be.gt(0);
    });

    it("should emit TokensReleased event", async function () {
      const { vestingWallet, deployTimestamp, beneficiary } =
        await networkHelpers.loadFixture(deployCleanFixture);

      const exactCliff = BigInt(deployTimestamp) + CLIFF_SECONDS;
      await networkHelpers.time.setNextBlockTimestamp(exactCliff);

      const elapsed = exactCliff - BigInt(deployTimestamp);
      const expected = (TOTAL_AMOUNT * elapsed) / DURATION_SECONDS;

      await expect(vestingWallet.connect(beneficiary).release())
        .to.emit(vestingWallet, "TokensReleased")
        .withArgs(beneficiary.address, expected);
    });

    it("should revert on double release with nothing new vested", async function () {
      const { vestingWallet, deployTimestamp, beneficiary } =
        await networkHelpers.loadFixture(deployCleanFixture);

      await networkHelpers.time.setNextBlockTimestamp(
        BigInt(deployTimestamp) + DURATION_SECONDS,
      );

      await vestingWallet.connect(beneficiary).release();

      await expect(
        vestingWallet.connect(beneficiary).release(),
      ).to.be.revertedWithCustomError(vestingWallet, "NothingToRelease");
    });

    it("should correctly track multiple releases over networkHelpers.time", async function () {
      const { token, vestingWallet, deployTimestamp, beneficiary } =
        await networkHelpers.loadFixture(deployCleanFixture);

      await networkHelpers.time.increaseTo(
        BigInt(deployTimestamp) + CLIFF_SECONDS,
      );
      await vestingWallet.connect(beneficiary).release();
      const afterFirst = await token.balanceOf(beneficiary.address);

      await networkHelpers.time.increaseTo(
        BigInt(deployTimestamp) + DURATION_SECONDS / 2n,
      );
      await vestingWallet.connect(beneficiary).release();
      const afterSecond = await token.balanceOf(beneficiary.address);

      await networkHelpers.time.increaseTo(
        BigInt(deployTimestamp) + DURATION_SECONDS,
      );
      await vestingWallet.connect(beneficiary).release();
      const afterThird = await token.balanceOf(beneficiary.address);

      expect(afterThird).to.be.closeTo(
        TOTAL_AMOUNT,
        ethers.parseUnits("1", 18),
      );
      expect(afterSecond).to.be.gt(afterFirst);
      expect(afterThird).to.be.gt(afterSecond);
    });

    it("should release full amount at end of duration", async function () {
      const { token, vestingWallet, deployTimestamp, beneficiary } =
        await networkHelpers.loadFixture(deployCleanFixture);
      await networkHelpers.time.increaseTo(
        BigInt(deployTimestamp) + DURATION_SECONDS,
      );
      await vestingWallet.connect(beneficiary).release();
      expect(await token.balanceOf(beneficiary.address)).to.equal(TOTAL_AMOUNT);
    });

    it("should revert with NotFunded error when not funded", async function () {
      const { vestingWallet } = await networkHelpers.loadFixture(
        deployCleanFixtureNoFund,
      );

      await expect(vestingWallet.release()).to.be.revertedWithCustomError(
        vestingWallet,
        "NotFunded",
      );
    });
  });

  describe("revoke()", function () {
    it("should revert when called by non-owner", async function () {
      const { vestingWallet, stranger } = await networkHelpers.loadFixture(
        deployCleanFixture,
      );
      await expect(
        vestingWallet.connect(stranger).revoke(),
      ).to.be.revertedWithCustomError(
        vestingWallet,
        "OwnableUnauthorizedAccount",
      );
    });

    it("should revert on double revoke", async function () {
      const { vestingWallet } = await networkHelpers.loadFixture(
        deployCleanFixture,
      );
      await vestingWallet.revoke();
      await expect(vestingWallet.revoke()).to.be.revertedWithCustomError(
        vestingWallet,
        "VestingAlreadyRevoked",
      );
    });

    it("should set revoked to true", async function () {
      const { vestingWallet } = await networkHelpers.loadFixture(
        deployCleanFixture,
      );
      await vestingWallet.revoke();
      expect(await vestingWallet.revoked()).to.equal(true);
    });

    it("should pay beneficiary earned tokens on revoke", async function () {
      const { token, vestingWallet, deployTimestamp, beneficiary } =
        await networkHelpers.loadFixture(deployCleanFixture);
      await networkHelpers.time.increaseTo(
        BigInt(deployTimestamp) + DURATION_SECONDS / 2n,
      );
      const balanceBefore = await token.balanceOf(beneficiary.address);
      await vestingWallet.revoke();
      const balanceAfter = await token.balanceOf(beneficiary.address);
      expect(balanceAfter - balanceBefore).to.be.closeTo(
        TOTAL_AMOUNT / 2n,
        ethers.parseUnits("1", 18),
      );
    });

    it("should return unvested tokens to owner on revoke", async function () {
      const { token, vestingWallet, deployTimestamp, owner } =
        await networkHelpers.loadFixture(deployCleanFixture);
      await networkHelpers.time.increaseTo(
        BigInt(deployTimestamp) + DURATION_SECONDS / 2n,
      );
      const ownerBalanceBefore = await token.balanceOf(owner.address);
      await vestingWallet.revoke();
      const ownerBalanceAfter = await token.balanceOf(owner.address);
      expect(ownerBalanceAfter - ownerBalanceBefore).to.be.closeTo(
        TOTAL_AMOUNT / 2n,
        ethers.parseUnits("1", 18),
      );
    });

    it("should emit VestingRevoked event", async function () {
      const { vestingWallet, deployTimestamp, beneficiary } =
        await networkHelpers.loadFixture(deployCleanFixture);
      await networkHelpers.time.setNextBlockTimestamp(
        BigInt(deployTimestamp) + DURATION_SECONDS / 2n,
      );
      await expect(vestingWallet.revoke())
        .to.emit(vestingWallet, "VestingRevoked")
        .withArgs(beneficiary.address, TOTAL_AMOUNT / 2n);
    });

    it("should correctly handle revoke after a partial release", async function () {
      const { token, vestingWallet, deployTimestamp, owner, beneficiary } =
        await networkHelpers.loadFixture(deployCleanFixture);

      await networkHelpers.time.increaseTo(
        BigInt(deployTimestamp) + CLIFF_SECONDS,
      );
      await vestingWallet.connect(beneficiary).release();

      await networkHelpers.time.increaseTo(
        BigInt(deployTimestamp) + DURATION_SECONDS / 2n,
      );
      const ownerBefore = await token.balanceOf(owner.address);
      await vestingWallet.revoke();
      const ownerAfter = await token.balanceOf(owner.address);

      expect(ownerAfter - ownerBefore).to.be.closeTo(
        TOTAL_AMOUNT / 2n,
        ethers.parseUnits("1", 18),
      );
      expect(await token.balanceOf(beneficiary.address)).to.be.closeTo(
        TOTAL_AMOUNT / 2n,
        ethers.parseUnits("1", 18),
      );
    });

    it("should freeze vestedAmount after revoke", async function () {
      const { vestingWallet, deployTimestamp } =
        await networkHelpers.loadFixture(deployCleanFixture);
      await networkHelpers.time.increaseTo(
        BigInt(deployTimestamp) + DURATION_SECONDS / 2n,
      );
      await vestingWallet.revoke();
      await networkHelpers.time.increaseTo(
        BigInt(deployTimestamp) + DURATION_SECONDS,
      );
      expect(await vestingWallet.vestedAmount()).to.equal(
        await vestingWallet.released(),
      );
    });
  });

  describe("View helpers", function () {
    it("releasableAmount() should return 0 before cliff", async function () {
      const { vestingWallet } = await networkHelpers.loadFixture(
        deployCleanFixture,
      );
      expect(await vestingWallet.releasableAmount()).to.equal(0);
    });

    it("releasableAmount() should return correct amount after cliff", async function () {
      const { vestingWallet, deployTimestamp } =
        await networkHelpers.loadFixture(deployCleanFixture);
      await networkHelpers.time.increaseTo(
        BigInt(deployTimestamp) + CLIFF_SECONDS,
      );
      const expected = (TOTAL_AMOUNT * CLIFF_SECONDS) / DURATION_SECONDS;
      expect(await vestingWallet.releasableAmount()).to.be.closeTo(
        expected,
        ethers.parseUnits("1", 18),
      );
    });

    it("vestingEnd() should return start + duration", async function () {
      const { vestingWallet, deployTimestamp } =
        await networkHelpers.loadFixture(deployCleanFixture);
      expect(await vestingWallet.vestingEnd()).to.equal(
        BigInt(deployTimestamp) + DURATION_SECONDS,
      );
    });

    it("releaseAmount() should return 0 when not funded", async function () {
      const { vestingWallet } = await networkHelpers.loadFixture(
        deployCleanFixtureNoFund,
      );

      expect(await vestingWallet.releasableAmount()).to.be.equal(0);
    });
  });

  describe("fund", () => {
    it("should have correctly funded the owner", async function () {
      const { token, vestingWallet } = await networkHelpers.loadFixture(
        deployCleanFixtureNoFund,
      );

      await expect(vestingWallet.fund())
        .to.emit(vestingWallet, "Funded")
        .withArgs(TOTAL_AMOUNT);

      expect(await vestingWallet.funded()).to.be.equal(true);
      expect(await token.balanceOf(await vestingWallet.getAddress())).to.equal(
        TOTAL_AMOUNT,
      );
    });

    it("should only allow owner to fund", async function () {
      const { vestingWallet, stranger } = await networkHelpers.loadFixture(
        deployCleanFixture,
      );

      await expect(
        vestingWallet.connect(stranger).fund(),
      ).to.be.revertedWithCustomError(
        vestingWallet,
        "OwnableUnauthorizedAccount",
      );
    });

    it("should not fund twice", async function () {
      // fund is called from fixture already as test setup
      const { vestingWallet } = await networkHelpers.loadFixture(
        deployCleanFixture,
      );

      await expect(vestingWallet.fund()).to.be.revertedWithCustomError(
        vestingWallet,
        "AlreadyFunded",
      );
    });
  });
});
