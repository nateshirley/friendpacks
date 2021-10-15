import React, { useEffect, useState } from "react";
import SearchBar from "./SearchBar";
import PackOverview from "./PackOverview";
import PackMembers from "./PackMembers";
import PackInteractivity from "./PackInteractivity";
import WalletPacks from "./WalletPacks";
import { PublicKey, SystemProgram } from '@solana/web3.js';
import bs58 from 'bs58';
import qs from "qs";
import { useWallet } from '@solana/wallet-adapter-react';
import { decodeMetadata } from "./decodeMetadata";
import { useLocation, useHistory } from 'react-router-dom';
import "../global.css";

//tokene xample, can join.  5q8E6jMNHTjzWRGkeUom7Q8uKgL6rgVdxuMmuePNXwQQ
//GgYncsn5mFYwNoc5h45nbMjQuxhm7Y2w5yWKWCTy5VKz
//D57gFXBTMAtmRHg6CjXsNjyUem9FjSWManLiMAMXVaEU

//i need to figure out how to reload when the key changes

const { getMembersForPackMint, getMetadataAddress, isMetadataV1Account, getPackMintKeysForWallet, fetchAllPackMintAccounts } = require('../../modules/queryHelper.js');
const TOKEN_PROGRAM_ID = new PublicKey('TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA');
const EXPECTED_MINT_AUTH = "C3BY8KyUgceUVjCyEuKfxM2uxmQv3iWrgd9rddD3tb7Q";
const Searches = {
    TOKEN: "token",
    WALLET: "wallet",
    NONE: "none"
}
const Privilege = {
    EDIT: "edit",
    JOIN: "join",
    NONE: "none"
}


const Find = (props) => {
    const wallet = useWallet();
    const { getProvider } = props;
    const history = useHistory();
    const [searchText, setSearchText] = useState('');
    const [searchStatus, setSearchStatus] = useState(Searches.NONE);

    //pack search state
    const [packImageLink, setPackImageLink] = useState('');
    const [packOverview, setPackOverview] = useState({
        name: "",
        symbol: "",
        memberCount: "",
        tokenMint: "",
    });
    const [packMembers, setPackMembers] = useState([]);
    const [packPrivilege, setPackPrivilege] = useState(Privilege.NONE);
    //wallet search state
    const [walletPackMints, setWalletPackMints] = useState([]);


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
            setSearchStatus(type);
        } else if (type === Searches.WALLET) {
            fetchPackMintsForWallet(publicKey);
            setSearchStatus(type);
        } else if (type === Searches.NONE) {
            console.log("not searching bc query doens't match type")
            setSearchStatus(type);
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
                return
            }
        }
        //fetchExamplePacks()
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const location = useLocation();
    useEffect(() => {
        console.log('Location changed');
        //console.log(location);
    }, [location]);

    const checkSearchType = async (searchText) => {
        let decoded = bs58.decode(searchText);
        if (decoded.length === 32) {
            let publicKey = new PublicKey(searchText);
            let accountInfo = await getProvider().connection.getAccountInfo(publicKey);
            if (accountInfo.owner) {
                if (accountInfo.owner.equals(TOKEN_PROGRAM_ID)) {
                    return [Searches.TOKEN, publicKey];
                } else if (accountInfo.owner.equals(SystemProgram.programId)) {
                    return [Searches.WALLET, publicKey];
                }
            }
        }
        return [Searches.NONE, ""];
    }
    const fetchPackDataObjectAtUri = (uri) => {
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
                console.log(metadata);
                setPackOverview({
                    name: metadata.data.name,
                    symbol: metadata.data.symbol,
                    memberCount: parsed.info.supply,
                    tokenMint: packMintKey.toBase58(),
                });
                fetchPackDataObjectAtUri(metadata.data.uri);
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

    const fetchPackMintsForWallet = async (walletPubkey) => {
        let provider = getProvider()
        let packMints = await getPackMintKeysForWallet(walletPubkey, provider.connection);
        setWalletPackMints(packMints)
        console.log(packMints);
    }


    //i can also just do like, a button that says -- "show me some random packs/examples
    //and then query for it then and refresh the page. fine intermediate solution
    const fetchExamplePacks = async () => {
        let provider = getProvider();
        let allPacks = await fetchAllPackMintAccounts(provider.connection);
        let allKeys = allPacks.map((pack) => {
            return pack.pubkey.toBase58()
        })
        let sampleKeys = []
        for (let i = 1; i <= 10; i++) {
            sampleKeys.push(allKeys[Math.floor(Math.random() * allKeys.length)])
        }
        //var sampleItem = allKeys[Math.floor(Math.random()*allKeys.length)]
        console.log(sampleKeys);
    }

    const clickedPack = (mintKey) => {
        console.log("clicked", mintKey)
        let mintString = mintKey.toBase58();
        setSearchText(mintString);
        history.push("?key=" + mintString);
        search(mintString);
    }


    let infoCards = null;
    switch (searchStatus) {
        case Searches.TOKEN:
            infoCards = (
                <div>
                    <PackOverview overview={packOverview} imageLink={packImageLink} />
                    <PackInteractivity privilege={packPrivilege} packOverview={packOverview} getProvider={getProvider} />
                    <PackMembers members={packMembers} />
                </div>
            )
            break;
        case Searches.WALLET:
            infoCards = (
                <div>
                    <WalletPacks packMints={walletPackMints} clickedPack={clickedPack} />
                </div>
            )
            break;
        default:
            infoCards = (
                <div>
                </div>
            )
            //add show random packs
    }



    return (
        <div className="component-parent">
            <div className="component-header">Find</div>
            <SearchBar handleSearchChange={handleSearchChange} searchText={searchText} />
            <button className="default-button search" onClick={didPressSearch}>search</button>
            {infoCards}
        </div>
    );
}

export default Find;