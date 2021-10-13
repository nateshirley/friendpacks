const anchor = require('@project-serum/anchor');
const { rpc, publicKey } = require('@project-serum/anchor/dist/cjs/utils');
const { Keypair, PublicKey, SystemProgram, SYSVAR_RENT_PUBKEY, Transaction } = anchor.web3;
const SPL = require("@solana/spl-token");
const { TOKEN_PROGRAM_ID, Token, MintLayout }  = SPL;
const { getSquadMintKeysForWallet, getMetadataAddress, getAssociatedTokenAccountAddress, createAssociatedTokenAccountInstruction, TOKEN_METADATA_PROGRAM_ID, getSquadMintAccountsForWallet, fetchAllPackMintAccounts, getMembersForPackMint, isWalletPackMember, isPackEligibleForNewMembers, buildConnectedMembersDict } = require('./modules/queries.js');
const nameService = require('@solana/spl-name-service');
const BN = require('bn.js');

//need to figure out how to turn off the primary market thing.

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
  let authPdaBump = null;
  let secondMember = Keypair.generate();
  let metadata = null;
  let TokenMint = null;
  //cli wallet
  let myWalletPubkey = new PublicKey("5J8jLVz5YY5uc9sJuWtx42VVMUanLGYWoPXMRu7GsNEJ");



  it('config', async () => {
    const _rent = await provider.connection.getMinimumBalanceForRentExemption(
      MintLayout.span
    );
    rent = _rent;

    let [_authPDA, _bump] = await PublicKey.findProgramAddress(
      //gets a determinstic pda address using this string and the program id
      [anchor.utils.bytes.utf8.encode("authority")],
      program.programId
    );
    authPda = _authPDA;
    authPdaBump = _bump

    payerTokenAccount = await getAssociatedTokenAccountAddress(payer.publicKey, mint.publicKey);

    await provider.connection.confirmTransaction(
      await provider.connection.requestAirdrop(secondMember.publicKey, (5 * anchor.web3.LAMPORTS_PER_SOL)),
      "confirmed"
    );

    let [_metadataAddress, _metadataBump] = await getMetadataAddress(mint.publicKey);
    metadata = _metadataAddress;
  });

  it('get mint owners', async () => {
    let samplePackMint = new PublicKey("5q8E6jMNHTjzWRGkeUom7Q8uKgL6rgVdxuMmuePNXwQQ");
    // let members = await getMembersForPackMint(mint, provider.connection);
    let [isMember, members] = await isWalletPackMember(myWalletPubkey, samplePackMint, provider.connection);
    console.log("is wallet member? ", isMember);
    console.log("number of members: ", members.length);

    //could also do mint authority but fuck it 
    let isPackFull = await isPackEligibleForNewMembers(samplePackMint, provider.connection);
    console.log("is pack full?", isPackFull);
  });

  //i need to pass this like a map of all the user's squad connections
  //maybe i could do like memberKey -> packMintKey
  it('get transactions for program', async () => {
    let altSampleKey = new PublicKey("HibUDZHM1rVeLzevaUb1vBuWFfGpxtisU36Un6V21pyR");
    //this is an object where connectedMembers[member] = [sharedPackMints]
    let connectedMembers = await buildConnectedMembersDict(altSampleKey, provider.connection);
    console.log(connectedMembers);

    let sharedPacks = connectedMembers[altSampleKey];
    console.log(sharedPacks);
    let otherShared = connectedMembers[myWalletPubkey];
    console.log(otherShared);

    let sharedActivity = [];

    //find all transactions where a connected member signed. append the packmints for that activity to the array
    let signatures = await provider.connection.getConfirmedSignaturesForAddress2(program.programId, {limit: 40}, "confirmed");
    await Promise.all(signatures.map(async (signatureInfo) => {
      let txResponse = await provider.connection.getTransaction(signatureInfo.signature, { commitment: "confirmed" });
      let message = txResponse.transaction.message;
      //account: PublicKey
      message.accountKeys.map((account, index) => {
        if (message.isAccountSigner(index)) {
          let sharedPacks = connectedMembers[account];
          if(Boolean(sharedPacks)) {
            sharedPacks.forEach((packMint) => {
              //im in a pack with the main wallet (provider), and it signs like every transaction. 
              console.log("shared activity on mint: ", packMint);
              sharedActivity.push(packMint);
            });
          }
        }
      });
    }));

    //let txResponse = await provider.connection.getTransaction("2Exmb8R2jjqJA75ygho1Fi7ZFb4n4vJhQi4Jxa4gp3MYm8p4fmoE16EfB1RWvZf5z2Kb1emFLKfmn4bgdkPmmFE", { commitment: "confirmed" });
    //let message = txResponse.transaction.message;
    //console.log(message);
    //console.log(message.accountKeys);
    // message.accountKeys.map((account, index) => {
    //   if (message.isAccountSigner(index)) {
    //     console.log("is SIGNER");
    //     console.log(account.toBase58());
    //   }
    // });

  });


 

  /*
  
  it('create a pack', async () => {
    const metaConfig = {
      name: "Grump Sleepwalker",
      symbol: "GRMP",
      uri: "https://arweave.net/O8x2J3gyUmRLm5ZRrUsP3anJiGst5Y4FYn2Wugbktls"
    };

    const tx = await program.rpc.createPack(authPdaBump, metaConfig, {
      accounts: {
        mint: mint.publicKey,
        mintAuth: authPda,
        tokenAccount: payerTokenAccount,
        owner: payer.publicKey,
        metadata: metadata,
        systemProgram: SystemProgram.programId,
        tokenProgram: TOKEN_PROGRAM_ID,
        tokenMetadataProgram: TOKEN_METADATA_PROGRAM_ID,
        rent: SYSVAR_RENT_PUBKEY,
      }, instructions: [
        //this requires the mint to sign 
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
        payer, mint
      ]
    });
    console.log("create pack tx ", tx);
  });
  

  it('join the pack with a different user', async () => {
    let secondTokenAccount = await getAssociatedTokenAccountAddress(secondMember.publicKey, mint.publicKey);

    //mint another
    const again = await program.rpc.joinPack(authPdaBump, {
      accounts: {
        mint: mint.publicKey,
        mintAuth: authPda,
        tokenAccount: secondTokenAccount,
        owner: secondMember.publicKey,
        tokenProgram: TOKEN_PROGRAM_ID
      }, instructions: [
        createAssociatedTokenAccountInstruction(
          mint.publicKey,
          secondTokenAccount,
          secondMember.publicKey,
          secondMember.publicKey,
        ),
      ],
      signers: [
        secondMember
      ]
    });
    console.log("second join sig", again);
  });
  */



  /*
  it('get token accounts owned by my test owner address', async () => {
    console.log("********");

    let squadMints = await getSquadMintAccountsForWallet(myWalletPubkey, provider.connection);
    console.log("number of pack mints owned by my wallet", squadMints.length);

    let accounts = await fetchAllPackMintAccounts(provider.connection);
    console.log("number of pack mints in total, ", accounts.length)
  });
  */

   /*
  it('name service', async() => {

    let nameAccount = new PublicKey("xbgtybr9MrMhSvzySvkxmZZ4eFk8YRkFgjrRfryZJDc");
    let fetch = await nameService.NameRegistryState.retrieve(provider.connection, nameAccount);
    console.log(fetch);

    //i know i could do a custom one for each account
    //would have to query getprogramAccounts for each tho. beat
    
    // let ins = await nameService.createNameRegistry(
    //   provider.connection,
    //   "swatchbuckler",
    //   1000,
    //   payer.publicKey,
    //   payer.publicKey
    // );
    // let tx = new Transaction().add(ins);
    // let signature = await anchor.web3.sendAndConfirmTransaction(
    //   provider.connection,
    //   tx,
    //   [provider.wallet.payer],
    // ); 
    // console.log(signature);
    // console.log(ins);
  });
  */



  
 
    


  

  /*
  it('try to change the name', async () => {
    const metaConfig = {
      name: "Grumpy Pants John",
      symbol: "OTPHJ",
      uri: "https://arweave.net/s9GUcE4pUFQ90V-dqI6uyEkHkVj6nidSuBoXkfuOrQE"
    };
    const tx = await program.rpc.updatePackMetadata(authPdaBump, metaConfig, {
      accounts: {
        mint: mint.publicKey,
        mintAuth: authPda,
        tokenAccount: payerTokenAccount,
        owner: payer.publicKey,
        metadata: metadata,
        systemProgram: SystemProgram.programId,
        tokenMetadataProgram: TOKEN_METADATA_PROGRAM_ID,
      }, 
      signers: [
        payer
      ]
    });
    console.log("change name tx: ", tx);
  });
  */

  
  

  /*
  it('see if it worked', async () => {
    let _TokenMint = new Token(
      provider.connection,
      mint.publicKey,
      TOKEN_PROGRAM_ID,
      payer
    );
    TokenMint = _TokenMint
    let info = await TokenMint.getAccountInfo(payerTokenAccount);
    //console.log(info.amount)
    let balance = await provider.connection.getTokenAccountBalance(payerTokenAccount);
    console.log("the user's token balance: ", balance);
    let mintInfo = await TokenMint.getMintInfo();
    console.log("the mint's supply: ", mintInfo.supply);
  });
  */

  // it("transfer the new mint", async () => {
  //   const myWalletPubkey = new PublicKey("D57gFXBTMAtmRHg6CjXsNjyUem9FjSWManLiMAMXVaEU");
  //   const payerTokenAccountAddress = await getAssociatedTokenAccountAddress(payer.publicKey, mint.publicKey);
  
  //   let myTokenAccountAddress = await TokenMint.createAssociatedTokenAccount(myWalletPubkey);
  //   let tx = await TokenMint.transfer(
  //     payerTokenAccountAddress,
  //     myTokenAccountAddress,
  //     payer.publicKey,
  //     [payer],
  //     1
  //   );
  //   console.log(tx)
  // });

});




//random tests ***************

  //test to show that you can't create a pack with a pda that is not the authority pda of the program
  // it('try the create pack', async () => {
  //   let [_fraudPDA, _bump] = await PublicKey.findProgramAddress(
  //     //gets a determinstic pda address using this string and the program id
  //     [anchor.utils.bytes.utf8.encode("fraud")],
  //     program.programId
  //   );
  //   let tx = await program.rpc.createPack(authPdaBump, {
  //     accounts: {
  //       mintAuth: _fraudPDA
  //     }
  //   })
  // });
  /*


    //this doesn't work bc the pda is not signing --- good
    await TokenMint.setAuthority(
      mint.publicKey,
      payer.publicKey,
      'FreezeAccount',
      authPda,
      [mint, payer]
    );
    */

    /*
  if you make a different token account (not owned by the owner) and try to mint to it, the constraint has_one = owner kicks in and blocks it
      
   await provider.connection.confirmTransaction(
      await provider.connection.requestAirdrop(otherPayer.publicKey, 50000000000),
      "confirmed"
  ) ;
  let otherPayer = Keypair.generate();
  let otherTokenAccount = null;
  otherTokenAccount = await getAssociatedTokenAccountAddress(otherPayer.publicKey, mint.publicKey);
  
  createAssociatedTokenAccountInstruction(
          mint.publicKey,
          otherTokenAccount,
          otherPayer.publicKey,
          otherPayer.publicKey,
        ),
  */


  //i'm not sure if someone can fuck this up by passing in a custom mint. my current thinking is no
  //wait yes. because i need to make sure the freeze authority is actually the authpda

   /*

    for each, i can either grab the freeze authority, or i can query for metadata
    this is going to include all kinds of tokens

    b5 97 72 bb a9 9e 1a 52 ff 58 a9 77 c8 e1 2d 32 0f 15 b8 9d 2e ec d7 2a b2 aa 0b 4d 1e 9b 55 71 3f d2 5c 99 fa 43 a1 35 77 36 84 2e 94 1d fa a4 f5 42 ... 115 more bytes>,
    50
    //165 bytes
    //1
    mint auth - 32
    supply - 8
    decimals - 1
    initialized: 1
    freeze auth - 32 



    */
