import { expect } from "chai";
import { network } from "hardhat";

const { ethers, networkHelpers } = await network.create();

describe("Token", function () {
  async function deployCleanFixture() {
    const [_, stranger] = await ethers.getSigners();

    const token = await ethers.deployContract("Token", [
      "Token",
      "TKN",
      1_000_000,
    ]);

    return {
      token,
      stranger,
    };
  }

  describe("mint", function () {
    it("should only be mintable by owner", async function () {
      const { token, stranger } = await networkHelpers.loadFixture(
        deployCleanFixture,
      );
      const mintAmount = ethers.parseUnits("500", 18);
      await token.mint(stranger.address, 500);
      expect(await token.balanceOf(stranger.address)).to.equal(mintAmount);
    });

    it("should not allow mint from not owner", async function () {
      const { token, stranger } = await networkHelpers.loadFixture(
        deployCleanFixture,
      );

      await expect(
        token.connect(stranger).mint(stranger.address, 500),
      ).to.be.revertedWithCustomError(token, "OwnableUnauthorizedAccount");
    });
  });
});
