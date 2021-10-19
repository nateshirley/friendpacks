import './../App.css';
import { useState } from 'react';
import { PublicKey } from '@solana/web3.js';
import { Program, web3 } from '@project-serum/anchor';
import { useWallet } from '@solana/wallet-adapter-react';
import idl from '../idl.json';
import "./global.css";
import { useHistory } from "react-router-dom";
import MoonLoader from "react-spinners/MoonLoader";
import { css } from "@emotion/react";


const { SystemProgram, Keypair, SYSVAR_RENT_PUBKEY } = web3;
const anchor = require('@project-serum/anchor');
const SPLToken = require("@solana/spl-token");
const { TOKEN_PROGRAM_ID, Token, MintLayout } = SPLToken;
const programID = new PublicKey(idl.metadata.address);
const { getMetadataAddress, getAssociatedTokenAccountAddress, createAssociatedTokenAccountInstruction, TOKEN_METADATA_PROGRAM_ID } = require('../modules/queryHelper.js');
const override = css`
display: block;
margin: 0 auto;
border-color: black;
`;

function Make(props) {
  const [name, setName] = useState('');
  const [symbol, setSymbol] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const { getProvider } = props;
  const wallet = useWallet();
  const history = useHistory();

  async function createPack() {
    const metaConfig = {
      name: name,
      symbol: symbol,
      uri: "https://nateshirley.github.io/data/default.json"
    };
    if (name.length < 1 || symbol.length < 1) {
      return
    }
    const provider = getProvider();
    const program = new Program(idl, programID, provider);

    console.log(provider);
    
    let [authPda, authPdaBump] = await PublicKey.findProgramAddress(
      //gets a determinstic pda address using this string and the program id
      [anchor.utils.bytes.utf8.encode("authority")],
      program.programId
    );

    let mint = Keypair.generate();
    let payer = provider.wallet.publicKey;
    //console.log(payer);

    let payerTokenAccount = await getAssociatedTokenAccountAddress(payer, mint.publicKey);
    let rent = await provider.connection.getMinimumBalanceForRentExemption(
      MintLayout.span
    );
    let [metadataAddress, _metadataBump] = await getMetadataAddress(mint.publicKey);

    setIsLoading(true);

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
    // console.log("create pack tx ", tx);
    setName('');
    setSymbol('');
    setIsLoading(false);
    //push user to pack details page with mint id
    history.replace("/find?key=" + mint.publicKey.toBase58())
    
  }

  let body = null;

  if (!wallet.connected) {
    body = (
      <div className="home-info" style={{ marginTop: "50px" }}>
        first, select devnet wallet ↗
      </div>
    )
  } else {
    body = (
      <div>
        <div>
          <input
            placeholder="pack name"
            onChange={e => setName(e.target.value)}
            value={name}
            className="default-input"
          />
        </div>
        <div>
          <input
            placeholder="pack symbol"
            onChange={e => setSymbol(e.target.value)}
            value={symbol}
            className="default-input"
          />
        </div>
        {isLoading
          ? <div style={{marginTop: "24px"}}><MoonLoader loading={true} size={31} css={override} /></div>
          : <button className="default-button make" onClick={createPack}>make new pack</button>
        }
      </div>
    )
  }

 

  return (
    <div className="component-parent make">
      <div className="component-header">New Pack</div>
      {body}
    </div>
  )
}

export default Make;

