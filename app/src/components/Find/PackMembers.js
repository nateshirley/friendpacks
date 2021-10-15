import React, { useEffect, useState, useCallback } from "react";
import { Row, Col, Container } from "react-bootstrap";

const PackMembers = ({ members }) => {


    if (members.length > 0) {
        let memberIndexLabels = [];
        let memberKeys = [];
        members.forEach((member, index) => {
            member = member.toBase58();
            memberIndexLabels.push(<div>{index + 1}.</div>);
            memberKeys.push((
                <div key={index}>{member}</div>
            ));
        });
        return (
            <div className="members-header">
                Members
            <Container className="members-card">
                <Row>
                    <Col className="member-index-labels">
                        {memberIndexLabels}
                    </Col>
                    <Col className="member-key-labels">
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