import React, { useEffect, useState, useCallback } from "react";
import { Program, web3 } from '@project-serum/anchor';
import idl from '../../idl.json';
import { useWallet } from '@solana/wallet-adapter-react';

const { PublicKey, SystemProgram } = web3;
const { TOKEN_PROGRAM_ID } = require("@solana/spl-token");
const anchor = require('@project-serum/anchor');
const programID = new PublicKey(idl.metadata.address);
const { getAssociatedTokenAccountAddress, createAssociatedTokenAccountInstruction, TOKEN_METADATA_PROGRAM_ID, getMetadataAddress } = require('../../modules/queries.js');
const Privilege = {
    EDIT: "edit",
    JOIN: "join",
    NONE: "none"
}
// {
//     name: "",
//     symbol: "",
//     memberCount: "",
//     tokenMint: "",
// });

const PackInteractivity = ({ privilege, packOverview, getProvider }) => {
    const wallet = useWallet();
    let [isEditing, setIsEditing] = useState(false);
    let [name, setName] = useState('');

    const joinPack = async () => {
        const provider = getProvider();
        const program = new Program(idl, programID, provider);
        const mint = new PublicKey(packOverview.tokenMint);

        let [authPda, authPdaBump] = await PublicKey.findProgramAddress(
            //gets a determinstic pda address using this string and the program id
            [anchor.utils.bytes.utf8.encode("authority")],
            program.programId
        );
        let tokenAccountKey = await getAssociatedTokenAccountAddress(wallet.publicKey, mint);
        const tx = await program.rpc.joinPack(authPdaBump, {
            accounts: {
                mint: mint,
                mintAuth: authPda,
                tokenAccount: tokenAccountKey,
                owner: wallet.publicKey,
                tokenProgram: TOKEN_PROGRAM_ID
            }, instructions: [
                createAssociatedTokenAccountInstruction(
                    mint,
                    tokenAccountKey,
                    wallet.publicKey,
                    wallet.publicKey,
                ),
            ],
            signers: [
                provider.wallet.payer
            ]
        });
        console.log(tx);
    }
    const didPressEditPack = () => {
        setIsEditing(true);
    }
    const editPack = async () => {
        const provider = getProvider();
        const program = new Program(idl, programID, provider);
        const mint = new PublicKey(packOverview.tokenMint);
        let [authPda, authPdaBump] = await PublicKey.findProgramAddress(
            //gets a determinstic pda address using this string and the program id
            [anchor.utils.bytes.utf8.encode("authority")],
            program.programId
        );
        let [metadata, _metadataBump] = await getMetadataAddress(mint);

        let tokenAccount = await getAssociatedTokenAccountAddress(wallet.publicKey, mint);
        const metaConfig = {
            name: name,
            symbol: null,
            uri: null
        };
        const tx = await program.rpc.updatePackMetadata(authPdaBump, metaConfig, {
            accounts: {
                mint: mint,
                mintAuth: authPda,
                tokenAccount: tokenAccount,
                owner: wallet.publicKey,
                metadata: metadata,
                systemProgram: SystemProgram.programId,
                tokenMetadataProgram: TOKEN_METADATA_PROGRAM_ID,
            },
            signers: [
                provider.wallet.payer
            ]
        });
        console.log(tx);
        window.location.reload();
    }


    let button = null;
    switch (privilege) {
        case Privilege.EDIT:
            button = <button onClick={didPressEditPack}>edit</button>;
            break;
        case Privilege.JOIN:
            button = <button onClick={joinPack}>join</button>
            break;
        case Privilege.NONE:
            button = <div>no priv</div>
            break;
        default:
            button = <div></div>
    }

    let editName = <div></div>;
    if (isEditing) {
        editName = (
            <div>
                <div>
                    <input
                        placeholder="set name"
                        onChange={e => setName(e.target.value)}
                        value={name}
                    />
                </div>
                <button onClick={editPack}>change shit</button>
            </div>
        )
    }

    return (
        <div>
            {button}
            {editName}
        </div>
    );


}

export default PackInteractivity;