const anchor = require('@project-serum/anchor');
const { rpc } = require('@project-serum/anchor/dist/cjs/utils');
const { Keypair, PublicKey, TransactionInstruction, SystemProgram } = anchor.web3;
const SPL = require("@solana/spl-token");
const { TOKEN_PROGRAM_ID, Token, MintLayout }  = SPL;

describe('pda_mint', () => {

  // Configure the client to use the local cluster.
  const provider = anchor.Provider.env()
  anchor.setProvider(provider);
  const program = anchor.workspace.PdaMint;

  let mint = Keypair.generate();
  let payer = provider.wallet.payer;
  let payerTokenAccount = null;
  let rent = null;
  let authPda = null;

  it('config', async () => {
    const _rent = await provider.connection.getMinimumBalanceForRentExemption(
      MintLayout.span
    );
    rent = _rent;
    let [_authPDA, nonce] = await PublicKey.findProgramAddress(
      //gets a determinstic pda address using this string and the program id
      [anchor.utils.bytes.utf8.encode("authority")],
      program.programId
    );
    authPda = _authPDA;

    payerTokenAccount = await getAssociatedTokenAccountAddress(payer.publicKey, mint.publicKey);
  });

  it('mint one token', async () => {
    const tx = await program.rpc.mintOne({
      accounts: {
        mint: mint.publicKey,
        mintAuth: authPda,
        tokenAccount: payerTokenAccount,
        tokenProgram: TOKEN_PROGRAM_ID,
        owner: payer.publicKey,
      }, instructions: [
        SystemProgram.createAccount({
          fromPubkey: payer.publicKey,
          newAccountPubkey: mint.publicKey,
          space: MintLayout.span,
          lamports: rent,
          programId: TOKEN_PROGRAM_ID
        }),
        // https://github.com/solana-labs/solana-program-library/blob/c371995c86d1ec21e5a44a76ed27152389024a2e/token/js/client/token.js#L1425
        Token.createInitMintInstruction(
          TOKEN_PROGRAM_ID,
          mint.publicKey,
          0,
          authPda,
          authPda,
        ),
        createAssociatedTokenAccountInstruction(
          mint.publicKey,
          payerTokenAccount,
          payer.publicKey,
          payer.publicKey,
        ),
      ], 
      signers: [
        payer, mint, 
      ]
    });
    console.log("Your transaction signature", tx);

    //i need to bring the create mint into the program
    // const again = await program.rpc.mintOne({
    //   accounts: {
    //     mint: mint.publicKey,
    //     mintAuth: authPda,
    //     tokenAccount: payerTokenAccount,
    //     tokenProgram: TOKEN_PROGRAM_ID
    //   },
    // });
    // console.log("Your transaction signature", again);
  });

  it('see if it worked', async () => {
    let TokenMint = new Token(
      provider.connection,
      mint.publicKey,
      TOKEN_PROGRAM_ID,
      payer
    );
    let info = await TokenMint.getAccountInfo(payerTokenAccount);
    //console.log(info.amount)
    let balance = await provider.connection.getTokenAccountBalance(payerTokenAccount);
    console.log("the user's token balance: ", balance);
    let mintInfo = await TokenMint.getMintInfo();
    console.log("the mint's supply: ", mintInfo.supply);
  });
});


function createAssociatedTokenAccountInstruction(
  mint,
  associatedAccount,
  owner,
  payer,
) {
  const data = Buffer.alloc(0);
  let associatedProgramId = new PublicKey('ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL');
  let programId = new PublicKey('TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA');
  let keys = [
    {pubkey: payer, isSigner: true, isWritable: true},
    {pubkey: associatedAccount, isSigner: false, isWritable: true},
    {pubkey: owner, isSigner: false, isWritable: false},
    {pubkey: mint, isSigner: false, isWritable: false},
    {pubkey: SystemProgram.programId, isSigner: false, isWritable: false},
    {pubkey: programId, isSigner: false, isWritable: false},
    {pubkey: anchor.web3.SYSVAR_RENT_PUBKEY, isSigner: false, isWritable: false},
  ];
  return new TransactionInstruction({
    keys,
    programId: associatedProgramId,
    data,
  });
}
async function getAssociatedTokenAccountAddress(owner, mint) {
  let associatedProgramId = new PublicKey('ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL');
  return (
    await PublicKey.findProgramAddress(
      [owner.toBuffer(), TOKEN_PROGRAM_ID.toBuffer(), mint.toBuffer()],
      associatedProgramId
    )
  )[0];
};