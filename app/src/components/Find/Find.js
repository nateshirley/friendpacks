import React, { useEffect, useState } from "react";
import SearchBar from "./SearchBar";
import PackOverview from "./PackOverview";
import PackMembers from "./PackMembers";
import PackInteractivity from "./PackInteractivity";
import { createBrowserHistory } from "history";
import { PublicKey, SystemProgram } from '@solana/web3.js';
import bs58 from 'bs58';
import qs from "qs";
import { useWallet } from '@solana/wallet-adapter-react';
import { decodeMetadata } from "./decodeMetadata";

//tokene xample, can join.  5q8E6jMNHTjzWRGkeUom7Q8uKgL6rgVdxuMmuePNXwQQ
//GgYncsn5mFYwNoc5h45nbMjQuxhm7Y2w5yWKWCTy5VKz
//D57gFXBTMAtmRHg6CjXsNjyUem9FjSWManLiMAMXVaEU

const { getMembersForPackMint, getMetadataAddress, isMetadataV1Account } = require('../../modules/queries.js');
const TOKEN_PROGRAM_ID = new PublicKey('TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA');
const EXPECTED_MINT_AUTH = "C3BY8KyUgceUVjCyEuKfxM2uxmQv3iWrgd9rddD3tb7Q";
const Searches = {
    TOKEN: "token",
    WALLET: "wallet",
}
const Privilege = {
    EDIT: "edit",
    JOIN: "join",
    NONE: "none"
}


const Find = (props) => {
    const wallet = useWallet();
    const { getProvider } = props;
    const history = createBrowserHistory();
    const [searchText, setSearchText] = useState('');
    const [packImageLink, setPackImageLink] = useState('');
    const [packOverview, setPackOverview] = useState({
        name: "",
        symbol: "",
        memberCount: "",
        tokenMint: "",
    });
    const [packMembers, setPackMembers] = useState([]);
    const [packPrivilege, setPackPrivilege] = useState(Privilege.NONE);

    const handleSearchChange = (text) => {
        setSearchText(text);
    }

    const didPressSearch = async () => {
        history.push("?key=" + searchText);
        search(searchText);
    }
    const search = async (searchText) => {
        let [type, publicKey] = await checkSearchType(searchText);
        if (type === Searches.TOKEN) {
            //fetch the token shit
            console.log('searching for token');
            fetchPackOverview(publicKey);
            fetchPackMembers(publicKey);
        } else if (type === Searches.WALLET) {

        } else {
            console.log("not searching bc query doens't match type")
        }
    }

    //this parses the url on first render and does a search if it finds a valid key in url params
    useEffect(() => {
        const filterParams = history.location.search.substr(1);
        const filtersFromParams = qs.parse(filterParams);
        if (filtersFromParams.key) {
            let packMintKey = String(filtersFromParams.key)
            let decoded = bs58.decode(packMintKey);
            if (decoded.length === 32) {
                search(packMintKey);
                setSearchText(packMintKey);
            }
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const checkSearchType = async (searchText) => {
        let decoded = bs58.decode(searchText);
        if (decoded.length === 32) {
            let publicKey = new PublicKey(searchText);
            let accountInfo = await getProvider().connection.getAccountInfo(publicKey);
            if (accountInfo.owner) {
                console.log(accountInfo.owner);
                if (accountInfo.owner.equals(TOKEN_PROGRAM_ID)) {
                    return [Searches.TOKEN, publicKey];
                } else if (accountInfo.owner.equals(SystemProgram.programId)) {
                    return [Searches.WALLET, publicKey];
                }
            }
        }
        return ["", ""];
    }
    const fetchObjectAtUri = (uri) => {
        try {
            fetch(uri)
                .then(async (_) => {
                    try {
                        const data = await _.json();
                        //console.log(data);
                        setPackImageLink(data.image);
                    } catch {
                        return undefined;
                    }
                })
                .catch(() => {
                    return undefined;
                });
        } catch (ex) {
            console.error(ex);
        }
    }
    const fetchPackOverview = async (packMintKey) => {
        let provider = getProvider();
        let result = (await provider.connection.getParsedAccountInfo(packMintKey)).value;
        let parsed = result.data.parsed;
        if (parsed.info.freezeAuthority !== EXPECTED_MINT_AUTH || result.data.program !== "spl-token") {
            console.log("bad result");
            return
        }
        // eslint-disable-next-line no-unused-vars
        const [metadataAddress, _bump] = await getMetadataAddress(packMintKey);
        const accountInfo = await provider.connection.getAccountInfo(metadataAddress);
        if (accountInfo && accountInfo.data.length > 0) {
            if (isMetadataV1Account(accountInfo)) {
                const metadata = decodeMetadata(accountInfo.data);
                setPackOverview({
                    name: metadata.data.name,
                    symbol: metadata.data.symbol,
                    memberCount: parsed.info.supply,
                    tokenMint: packMintKey.toBase58(),
                });
                fetchObjectAtUri(metadata.data.uri);
            };
        }
    }
    const fetchPackMembers = async (packMintKey) => {
        let provider = getProvider();
        let members = await getMembersForPackMint(packMintKey, provider.connection);
        setPackMembers(members);
    }
    useEffect(() => {
        let privilege = "";
        if (wallet.connected) {
            packMembers.forEach((member) => {
                if (member.equals(wallet.publicKey)) {
                    privilege = Privilege.EDIT;
                }
            });
            let memberCount = Number(packOverview.memberCount);
            if (privilege.length === 0 && Boolean(memberCount) && memberCount < 7) {
                privilege = Privilege.JOIN;
            }
        } 
        if (privilege.length === 0) {
            privilege = Privilege.NONE;
        }
        setPackPrivilege(privilege);
    }, [wallet.connected, wallet.publicKey, packMembers, packOverview.memberCount]);

    return (
        <div>
            <h2>Find</h2>
            <SearchBar handleSearchChange={handleSearchChange} searchText={searchText} />
            <button onClick={didPressSearch}>search</button>
            <p>show some details</p>
            <PackOverview overview={packOverview} imageLink={packImageLink} />
            <PackInteractivity privilege={packPrivilege} packOverview={packOverview} getProvider={getProvider} />
            <PackMembers members={packMembers} />
        </div>
    );
}

export default Find;