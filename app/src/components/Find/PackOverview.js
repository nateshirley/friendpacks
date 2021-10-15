import React, { useEffect, useState, useCallback } from "react";
import { Row, Col, Container } from "react-bootstrap";

/*
    {
        name: "",
        symbol: "",
        memberCount: "",
        tokenMint: "",
    }
*/

const PackOverview = ({ overview, imageLink }) => {

    let image = null;
    if (imageLink.length > 0) {
        image = <img src={imageLink} alt="pack avatar" style={{ height: '100%', width: '100%', marginLeft: '11px' }} />
    } else {
        image = <div />
    }

    return (
        <div>
            <div className="overview-header">Overview</div>
            <Container className="overview-card">
                <Row>
                    <Col xs={4}>{image}</Col>
                    <Col xs={3} className="overview-labels">
                        <div>name</div>
                        <div>symbol</div>
                        <div>members</div>
                        <div>token mint</div>
                    </Col>
                    <Col xs={5}>
                        <div className="overview-row">{overview.name}</div>
                        <div className="overview-row">{overview.symbol}</div>
                        <div className="overview-row">{overview.memberCount}</div>
                        <a href={`https://solscan.io/token/${overview.tokenMint}?cluster=devnet`} className="overview-row" target="_blank" rel="noreferrer noopener">{overview.tokenMintDisplayString}</a>
                    </Col>
                </Row>
            </Container>
        </div>
    );


}

export default PackOverview;