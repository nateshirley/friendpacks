import React, { useEffect, useState, useCallback } from "react";
import { Link } from 'react-router-dom';
import { Row, Col, Container } from "react-bootstrap";


const WalletPacks = ({ packMints, clickedPack }) => {



    const toDisplayString = (publicKey) => {
        let b58 = publicKey.toBase58();
        return (b58.slice(0, 7) + "....." + b58.slice(b58.length - 8, b58.length));
    }

    let packMintLabels = [];
    let packMintItems = [];
    if (packMints.length > 0) {
        packMints.forEach((mint, index) => {
            let mintString = toDisplayString(mint);
            let linkTo = `/find?key=${mint.toBase58()}`
            packMintLabels.push(<div key={index}>{index + 1}.</div>);
            packMintItems.push((
                <div key={index}>
                    <Link to={linkTo} onClick={() => clickedPack(mint)}>{mintString}</Link>
                </div>
            ));
        });
    } else {
        packMintItems = <div></div>
    }
    let packs = packMints.length === 1 ? "packs" : "packs"
    return (
        <div className="members-header">
            Wallet Packs
            <Container className="members-card">
                <div className="packs-count">This wallet has joined {packMints.length} {packs}.</div>
                <Row>
                    <Col sm={2} className="member-index-labels">
                        {packMintLabels}
                    </Col>
                    <Col sm={9} className="member-key-labels">
                        {packMintItems}
                    </Col>
                </Row>
            </Container>
        </div>
    )
}

export default WalletPacks;