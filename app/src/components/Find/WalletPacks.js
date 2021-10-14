import React, { useEffect, useState, useCallback } from "react";
import { Link } from 'react-router-dom';


const WalletPacks = ({ packMints, clickedPack }) => {

    // function refreshPage() {
    //     window.location.reload();
    // }

    let packMintItems = null;
    if (packMints.length > 0) {
        packMintItems = packMints.map((mint, index) => {
            let mintString = mint.toBase58();
            let linkTo = `/find?key=${mintString}`
            return (
                <div key={index}>pack mint: &nbsp;
                    <Link to={linkTo} onClick={ () => clickedPack(mint)}>{mintString}</Link>
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