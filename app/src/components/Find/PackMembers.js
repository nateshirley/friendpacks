import React, { useEffect, useState, useCallback } from "react";
import { Row, Col, Container } from "react-bootstrap";

const PackMembers = ({ members, didPressPackMember }) => {

    const toDisplayString = (publicKey) => {
        let b58 = publicKey.toBase58();
        return (b58.slice(0,7) + "....." + b58.slice(b58.length - 8, b58.length - 1));
    }

    if (members.length > 0) {
        let memberIndexLabels = [];
        let memberKeys = [];
        members.forEach((member, index) => {
            let displayMember = toDisplayString(member)
            memberIndexLabels.push(<div key={index}>{index + 1}.</div>);
            memberKeys.push((
                <div key={index}>
                    <button onClick={() => didPressPackMember(member)} key={index} className="member-button">{displayMember}</button>
                </div>
            ));
        });
        return (
            <div className="members-header">
                Members
            <Container className="members-card">
                <Row>
                    <Col sm={2} className="member-index-labels">
                        {memberIndexLabels}
                    </Col>
                    <Col sm={9} className="member-key-labels">
                        {memberKeys}
                    </Col>
                </Row>
            </Container>
            </div>
        );
    } else {
        return (<div></div>);
    }

}

export default PackMembers;