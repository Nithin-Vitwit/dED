import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { Anchor } from "../target/types/anchor";
import { expect } from "chai";

describe("anchor", () => {
  // Configure the client to use the local cluster.
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);

  const program = anchor.workspace.Anchor as Program<Anchor>;

  const creator = anchor.web3.Keypair.generate();
  const buyer = anchor.web3.Keypair.generate();
  const user = anchor.web3.Keypair.generate();

  const assetPrice = new anchor.BN(1000000000); // 1 SOL
  const arweaveId = "arweave-hash-123";

  // Deriving PDAs
  const [assetPda] = anchor.web3.PublicKey.findProgramAddressSync(
    [
      Buffer.from("asset"),
      creator.publicKey.toBuffer(),
      Buffer.from(arweaveId)
    ],
    program.programId
  );

  const [buyerAccessPda] = anchor.web3.PublicKey.findProgramAddressSync(
    [
      Buffer.from("access"),
      assetPda.toBuffer(),
      buyer.publicKey.toBuffer()
    ],
    program.programId
  );

  const [userAccessPda] = anchor.web3.PublicKey.findProgramAddressSync(
    [
      Buffer.from("access"),
      assetPda.toBuffer(),
      user.publicKey.toBuffer()
    ],
    program.programId
  );

  it("Is initialized and Asset Created!", async () => {
    // Airdrop SOL to creator
    await provider.connection.confirmTransaction(
      await provider.connection.requestAirdrop(creator.publicKey, 2 * anchor.web3.LAMPORTS_PER_SOL),
      "confirmed"
    );

    await program.methods
      .initAsset(assetPrice, arweaveId)
      .accounts({
        asset: assetPda,
        creator: creator.publicKey,
        systemProgram: anchor.web3.SystemProgram.programId,
      })
      .signers([creator])
      .rpc();

    const assetAccount = await program.account.asset.fetch(assetPda);
    expect(assetAccount.owner.toString()).to.equal(creator.publicKey.toString());
    expect(assetAccount.price.eq(assetPrice)).to.be.true;
    expect(assetAccount.arweaveId).to.equal(arweaveId);
  });

  it("Buys an asset", async () => {
    // Airdrop SOL to buyer
    await provider.connection.confirmTransaction(
      await provider.connection.requestAirdrop(buyer.publicKey, 2 * anchor.web3.LAMPORTS_PER_SOL),
      "confirmed"
    );

    const creatorBalanceBefore = await provider.connection.getBalance(creator.publicKey);

    await program.methods
      .buyAsset()
      .accounts({
        accessState: buyerAccessPda,
        asset: assetPda,
        buyer: buyer.publicKey,
        creator: creator.publicKey,
        systemProgram: anchor.web3.SystemProgram.programId,
      })
      .signers([buyer])
      .rpc();

    const accessState = await program.account.accessState.fetch(buyerAccessPda);
    expect(accessState.user.toString()).to.equal(buyer.publicKey.toString());
    expect(accessState.asset.toString()).to.equal(assetPda.toString());

    const creatorBalanceAfter = await provider.connection.getBalance(creator.publicKey);
    expect(creatorBalanceAfter - creatorBalanceBefore).to.equal(assetPrice.toNumber());
  });

  it("Grants access (whitelist)", async () => {
      // Creator grants access to 'user' without payment
      await program.methods
      .grantAccess()
      .accounts({
          accessState: userAccessPda,
          asset: assetPda,
          creator: creator.publicKey,
          user: user.publicKey,
          systemProgram: anchor.web3.SystemProgram.programId,
      })
      .signers([creator])
      .rpc();

      const accessState = await program.account.accessState.fetch(userAccessPda);
      expect(accessState.user.toString()).to.equal(user.publicKey.toString());
      expect(accessState.asset.toString()).to.equal(assetPda.toString());
  });
});
