import React, { useEffect, useState, useCallback } from "react";
import { Program, web3 } from '@project-serum/anchor';
import idl from '../../idl.json';
import { useWallet } from '@solana/wallet-adapter-react';
import { Row, Col, Container } from "react-bootstrap";

const { PublicKey, SystemProgram } = web3;
const { TOKEN_PROGRAM_ID } = require("@solana/spl-token");
const anchor = require('@project-serum/anchor');
const programID = new PublicKey(idl.metadata.address);
const { getAssociatedTokenAccountAddress, createAssociatedTokenAccountInstruction, TOKEN_METADATA_PROGRAM_ID, getMetadataAddress } = require('../../modules/queryHelper.js');
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
//      tokenMintDisplayString
// });

const PackInteractivity = ({ privilege, packOverview, getProvider, determinePackMembers }) => {
    const wallet = useWallet();
    let [isEditing, setIsEditing] = useState(false);
    const [name, setName] = useState('');
    const [symbol, setSymbol] = useState('');
    const [uri, setUri] = useState('');

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
        determinePackMembers(mint);
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
            symbol: symbol,
            uri: uri
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

    useEffect(() => {
        setName(packOverview.name);
        setSymbol(packOverview.symbol);
        setUri(packOverview.uri);
    }, [packOverview]);


    let isPackFull = Number(packOverview.memberCount) > 6 ? true : false;
    let body = null;
    switch (privilege) {
        case Privilege.EDIT:
            //user can edit. just a big edit button for the whole body
            if (isEditing) {
                body = (
                    <div className="pack-interactivity-info">
                        <Container className="members-card">
                            <Row>
                                <Col sm={2}>
                                    <div className="edit-label">name</div>
                                    <div className="edit-label">symbol</div>
                                    <div className="edit-label">uri</div>
                                </Col>
                                <Col>
                                    <div>
                                        <input
                                            placeholder="new name"
                                            onChange={e => setName(e.target.value)}
                                            value={name}
                                            className="edit-pack-input"
                                        />
                                    </div>
                                    <div>
                                        <input
                                            placeholder="new symbol"
                                            onChange={e => setSymbol(e.target.value)}
                                            value={symbol}
                                            className="edit-pack-input"
                                        />
                                    </div>
                                    <div>
                                        <input
                                            placeholder="new uri"
                                            onChange={e => setUri(e.target.value)}
                                            value={uri}
                                            className="edit-pack-input"
                                        />
                                    </div>
                                </Col>

                            </Row>
                        </Container>
                        <button onClick={editPack} className="submit-changes">submit changes</button>
                    </div>
                )
            } else {
                body = <button onClick={didPressEditPack} className="pack-interactive-button edit">edit this pack</button>;
            }
            break;
        case Privilege.JOIN:
            if (isPackFull) {
                //wallet connected, not a member, but the pack is full. (should probably just return nothing)
                body = (
                    <div className="pack-interactivity-info">
                        Pack is full. This wallet is not a member.
                    </div>
                )
            } else {
                body = (<button onClick={joinPack} className="pack-interactive-button join">join this pack</button>)
            }
            break;
        case Privilege.NONE:
            if (isPackFull) {
                body = (
                    <div className="pack-interactivity-info">
                        Pack is full. If you're a member, connect devnet wallet to make edits.
                    </div>
                )
            } else {
                body = (
                    <div className="pack-interactivity-info">
                        Connect devnet wallet to join this pack or make edits.
                    </div>
                )
            }
            break;
        default:
            body = <div></div>
    }

    return (
        <div>{body}</div>
    );


}

export default PackInteractivity;

