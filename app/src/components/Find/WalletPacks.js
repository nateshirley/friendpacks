import React, { useEffect, useState, useCallback } from "react";
import { Link } from 'react-router-dom';


const WalletPacks = ({ packMints }) => {

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
    let packs = packMints.length === 1 ? "packs" : "packs"
    return (
        <div>
            <div>This person has joined {packMints.length} {packs}.</div>
            <div>{packMintItems}</div>
        </div>
    )
}

export default WalletPacks;