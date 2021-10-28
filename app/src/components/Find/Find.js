import React, { useEffect, useState, useCallback } from "react";
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
import { displayPartsToString } from "typescript";


//E2kNXpspKhbubHdgGBJDnr6TYTZHPpDLRtYsa4HyNrGb -- newest example
//D57gFXBTMAtmRHg6CjXsNjyUem9FjSWManLiMAMXVaEU -- wallet



const { getMembersForPackMint, getMetadataAddress, isMetadataV1Account, getPackMintKeysForWallet, fetchAllPackMintAccounts } = require('../../modules/queryHelper.js');
const TOKEN_PROGRAM_ID = new PublicKey('TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA');
const EXPECTED_MINT_AUTH = "7p18ccUgAidUyLa2vGbBiWPbCwpx9D8V7pDCeFXQaCuJ"; //old met auth C3BY8KyUgceUVjCyEuKfxM2uxmQv3iWrgd9rddD3tb7Q,
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
    const [randomPacks, setRandomPacks] = useState([]);
    const [didPressInvite, setDidPressInvite] = useState(false);
    //pack search state
    const [packImageLink, setPackImageLink] = useState('');
    const [packOverview, setPackOverview] = useState({
        name: "",
        symbol: "",
        memberCount: "",
        tokenMint: "",
        tokenMintDisplayString: "",
        uri: ""
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
            determinePackMembers(publicKey);
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
            }
        }
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
            console.log("");
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
                    tokenMintDisplayString: toDisplayString(packMintKey),
                    uri: metadata.data.uri
                });
                fetchPackDataObjectAtUri(metadata.data.uri);
            };
        }
    }

    const determinePackMembers = async (packMintKey) => {
        let provider = getProvider();
        let members = await getMembersForPackMint(packMintKey, provider.connection);
        setPackMembers(members);
    }
    const determinePrivilege = useCallback(() => {
        console.log("updating privilege")
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
    useEffect(() => {
        determinePrivilege();
    }, [wallet.connected, wallet.publicKey, packMembers, packOverview.memberCount, determinePrivilege]);

    const fetchPackMintsForWallet = async (walletPubkey) => {
        let provider = getProvider()
        let packMints = await getPackMintKeysForWallet(walletPubkey, provider.connection);
        setWalletPackMints(packMints)
        //console.log(packMints);
    }


    //i can also just do like, a button that says -- "show me some random packs/examples
    //and then query for it then and refresh the page. fine intermediate solution
    const fetchExamplePacks = async () => {
        let provider = getProvider();
        let allResponses = await fetchAllPackMintAccounts(provider.connection);
        let exampleResponses = []
        for (let i = 1; i <= 10; i++) {
            exampleResponses.push(allResponses[Math.floor(Math.random() * allResponses.length)])
        }
        let exampleKeys = exampleResponses.map((response) => {
            const metadata = decodeMetadata(response.account.data);
            //console.log(metadata);
            return new PublicKey(metadata.mint);
        })
        setRandomPacks(exampleKeys);
    }

    const clickedPack = (mintKey) => {
        console.log("clicked", mintKey)
        let mintString = mintKey.toBase58();
        setSearchText(mintString);
        history.push("?key=" + mintString);
        search(mintString);
    }

    const toDisplayString = (publicKey) => {
        let b58 = publicKey.toBase58();
        return (b58.slice(0, 4) + "..." + b58.slice(b58.length - 5, b58.length - 1));
    }

    const didPressPackMember = (publicKey) => {
        let searchString = publicKey.toBase58();
        setSearchText(searchString);
        history.push("?key=" + searchString);
        search(searchString);
    }

    const copyPackToClipboard = () => {
        navigator.clipboard.writeText(window.location.href).then(() => {
            setDidPressInvite(true);
        }, () => {
            console.log("did not sucessfully copy to clipboard");
        });
    }
    let inviteButton = null;
    if (didPressInvite) {
        inviteButton = <div className="copied-link">copied link to clipboard!</div>
    } else {
        inviteButton = (<button className="invite-friends" onClick={copyPackToClipboard}>invite friends</button>);
    }

    let infoCards = null;
    switch (searchStatus) {
        case Searches.TOKEN:
            infoCards = (
                <div>
                    <PackOverview overview={packOverview} imageLink={packImageLink} />
                    <PackInteractivity privilege={packPrivilege} packOverview={packOverview} getProvider={getProvider} determinePackMembers={determinePackMembers} />
                    <PackMembers members={packMembers} didPressPackMember={didPressPackMember} />
                    {inviteButton}
                    <div className="press-the-button-parent">
                        <a href="https://www.pressthebutton.xyz" className="press-the-button" target="_blank" rel="noreferrer noopener">have you pressed the button?</a>
                    </div>
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
            if (randomPacks.length > 0) {
                let packMintItems = [];
                randomPacks.forEach((packMint, index) => {
                    let mintString = toDisplayString(packMint);
                    packMintItems.push((
                        <div key={index}>
                            <button onClick={() => clickedPack(packMint)} className="random-button">{mintString}</button>
                        </div>
                    ));
                })
                infoCards = (
                    <div>
                        <div style={{ fontWeight: "500", marginBottom: "6px", marginTop: "40px" }}>random packs: </div>
                        {packMintItems}
                    </div>
                )
            } else {
                infoCards = (
                    <div>
                        <div className="random-button-position">or,
                            <button className="random-button" onClick={fetchExamplePacks}>grab some random packs</button>
                        </div>
                    </div>
                )
            }

        //add show random packs
    }



    return (
        <div className="component-parent">
            <div className="component-header">Find a Pack</div>
            <SearchBar handleSearchChange={handleSearchChange} searchText={searchText} />
            <button className="default-button search" onClick={didPressSearch}>search</button>
            {infoCards}
        </div>
    );
}

export default Find;

//E5oxngwMMygv42MWNLAwN83CJ2Pk6Zyk9P8DFsTNNVxm -- new program ID
//old program id
//tokene xample, can join.  5q8E6jMNHTjzWRGkeUom7Q8uKgL6rgVdxuMmuePNXwQQ
//GgYncsn5mFYwNoc5h45nbMjQuxhm7Y2w5yWKWCTy5VKz
