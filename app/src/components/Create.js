import './../App.css';
import { useState } from 'react';
import { Connection, PublicKey, clusterApiUrl } from '@solana/web3.js';
import { Program, Provider, web3 } from '@project-serum/anchor';
import { useWallet } from '@solana/wallet-adapter-react';
import idl from '../idl.json';


const { SystemProgram, Keypair, SYSVAR_RENT_PUBKEY } = web3;
const anchor = require('@project-serum/anchor');
const SPLToken = require("@solana/spl-token");
const { TOKEN_PROGRAM_ID, Token, MintLayout } = SPLToken;
const programID = new PublicKey(idl.metadata.address);
const { getSquadMintKeysForWallet, getMetadataAddress, getAssociatedTokenAccountAddress, createAssociatedTokenAccountInstruction, TOKEN_METADATA_PROGRAM_ID, getSquadMintAccountsForWallet, fetchAllPackMintAccounts, getMembersForPackMint, isWalletPackMember, isPackEligibleForNewMembers, buildConnectedMembersDict } = require('../modules/queries.js');


function Create(props) {
  const [name, setName] = useState('');
  const [symbol, setSymbol] = useState('');
  const wallet = useWallet();
  const opts = {
    preflightCommitment: "processed"
  }

  //hell yes. this works. provider is anchor specific
  async function getProvider() {
    const network = clusterApiUrl('devnet');
    const connection = new Connection(network, opts.preflightCommitment);
    const provider = new Provider(
      connection, wallet, opts.preflightCommitment,
    );
    return provider;
  }

  async function createPack() {
    const metaConfig = {
      name: name,
      symbol: symbol,
      uri: "https://arweave.net/O8x2J3gyUmRLm5ZRrUsP3anJiGst5Y4FYn2Wugbktls"
    };
    const provider = await getProvider();
    const program = new Program(idl, programID, provider);

    let [authPda, authPdaBump] = await PublicKey.findProgramAddress(
      //gets a determinstic pda address using this string and the program id
      [anchor.utils.bytes.utf8.encode("authority")],
      program.programId
    );

    let mint = Keypair.generate();
    let payer = provider.wallet.publicKey;
    console.log(payer);

    let payerTokenAccount = await getAssociatedTokenAccountAddress(payer, mint.publicKey);
    let rent = await provider.connection.getMinimumBalanceForRentExemption(
      MintLayout.span
    );
    let [metadataAddress, _metadataBump] = await getMetadataAddress(mint.publicKey);

    const tx = await program.rpc.createPack(authPdaBump, metaConfig, {
      accounts: {
        mint: mint.publicKey,
        mintAuth: authPda,
        tokenAccount: payerTokenAccount,
        owner: payer,
        metadata: metadataAddress,
        systemProgram: SystemProgram.programId,
        tokenProgram: TOKEN_PROGRAM_ID,
        tokenMetadataProgram: TOKEN_METADATA_PROGRAM_ID,
        rent: SYSVAR_RENT_PUBKEY,
      }, instructions: [
        //this requires the mint to sign 
        SystemProgram.createAccount({
          fromPubkey: payer,
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
          payer,
          payer,
        ),
      ],
      signers: [
        provider.wallet.payer, mint
      ]
    });
    console.log("create pack tx ", tx);
    setName('');
    setSymbol('');
    //push user to pack details page with mint id
  }
  if (!wallet.connected) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', marginTop: '100px' }}>
        connect your wallet
      </div>
    )
  }
  return (
    <div className="App">
      <div>
        <div>
          <input
            placeholder="set name"
            onChange={e => setName(e.target.value)}
            value={name}
          />
        </div>
        <div>
          <input
            placeholder="set symbol"
            onChange={e => setSymbol(e.target.value)}
            value={symbol}
          />
        </div>
        <button onClick={createPack}>create pack</button>
      </div>
    </div>
  );
}

export default Create;

