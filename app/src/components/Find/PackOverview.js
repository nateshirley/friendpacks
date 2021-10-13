import React, { useEffect, useState, useCallback } from "react";


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
        image = <img src={imageLink} alt="pack avatar" style={{ height: '200px', width: '200px' }} />
    } else {
        image = <div />
    }

    return (
        <div>
            <div>{image}</div>
            <div>{overview.name}</div>
            <div>{overview.symbol}</div>
            <div>{overview.memberCount}</div>
            <div>{overview.tokenMint}</div>
        </div>
    );


}

export default PackOverview;