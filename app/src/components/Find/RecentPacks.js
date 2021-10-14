import React, { useEffect, useState, useCallback } from "react";
import { Link } from 'react-router-dom';


const RecentPacks = ({ packMints }) => {

    function refreshPage() {
        window.location.reload();
    }

    let packMintItems = null;
    if (packMints.length > 0) {
        packMintItems = packMints.map((mint, index) => {
            mint = mint.toBase58();
            let linkTo = `/find?key=${mint}`
            return (
                <div key={index}>pack mint: &nbsp;
                    <Link to={linkTo} onClick={refreshPage}>{mint}</Link>
                </div>
            );
        })
    } else {
        packMintItems = <div></div>
    }
    
    return (
        <div>
            <div>{packMintItems}</div>
        </div>
    );
}

export default RecentPacks;