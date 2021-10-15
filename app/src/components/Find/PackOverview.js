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
        image = <img src={imageLink} alt="pack avatar" style={{ height: '100px', width: '100px' }} />
    } else {
        image = <div />
    }

    return (
        <div>
            <div className="overview-header">Overview</div>
            <Container className="overview-card">
                <Row>
                    <Col xs={4}>{image}</Col>
                    <Col xs={2} style={{ backgroundColor: "blue" }}>
                        <div>{overview.name}</div>
                        <div>{overview.symbol}</div>
                        <div>{overview.memberCount}</div>
                        <div>{overview.tokenMint}</div>
                    </Col>
                    <Col xs={4}>another</Col>
                </Row>
            </Container>
        </div>
    );


}

export default PackOverview;