const anchor = require('@project-serum/anchor');
const { PublicKey, TransactionInstruction, SystemProgram, SYSVAR_RENT_PUBKEY, Keypair } = anchor.web3;
const SPLToken = require("@solana/spl-token");
const { TOKEN_PROGRAM_ID, Token } = SPLToken;
const nameService = require('@solana/spl-name-service');

const TOKEN_METADATA_PROGRAM_ID = new PublicKey("metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8bt518x1s");
exports.TOKEN_METADATA_PROGRAM_ID = TOKEN_METADATA_PROGRAM_ID;
const PACK_PROGRAM_ID = new PublicKey("5GstP3i7wvo1NEiPDUa9TcdqFFFYaaZDATX2WyVquzT4");
const ASSOCIATED_PROGRAM_ID = new PublicKey('ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL');


const mintHasVerifiedCreator = async (mintPubkey, expectedCreator, connection) => {
    let [metadataAddress, _bump] = await getMetadataAddress(mintPubkey);
    let metadataInfo = await connection.getAccountInfo(metadataAddress);
    if (Boolean(metadataInfo)) {
        let firstCreator = new PublicKey(metadataInfo.data.slice(326, 358));
        let isFirstCreatorVerified = metadataInfo.data[358];
        if (expectedCreator.equals(firstCreator) && isFirstCreatorVerified) {
            //console.log("the creator is good");
            return true
        }
    }
    return false
}
exports.mintHasVerifiedCreator = mintHasVerifiedCreator;

const getPackMintKeysForWallet = async (walletPubkey, connection) => {
    walletPubkey = new PublicKey(walletPubkey);
    if (Boolean(walletPubkey)) {
        let fetch = await connection.getTokenAccountsByOwner(walletPubkey, {
            programId: TOKEN_PROGRAM_ID
        });
        let responses = Array.from(fetch.value);
        return await filterResponsesForSquadMintKeys(responses, connection);
    }
}
exports.getPackMintKeysForWallet = getPackMintKeysForWallet;

const filterResponsesForSquadMintKeys = async (responses, connection) => {
    responses = Array.from(responses);
    let mintKeys = [];
    const [expectedCreator, _bump] = await getAuthPda();
    //response: {account: AccountInfo<Buffer>; pubkey: PublicKey }
    await Promise.all(responses.map(async (response) => {
        let mintKey = new PublicKey(response.account.data.slice(0, 32));
        if (await mintHasVerifiedCreator(mintKey, expectedCreator, connection)) {
            mintKeys.push(mintKey);
        }
    }));
    return mintKeys
}

const getPackMintAccountsForWallet = async (walletPubkey, connection) => {
    walletPubkey = new PublicKey(walletPubkey);
    if (Boolean(walletPubkey)) {
        let fetch = await connection.getTokenAccountsByOwner(walletPubkey, {
            programId: TOKEN_PROGRAM_ID
        });
        let responses = Array.from(fetch.value);
        return await filterResponsesForSquadMintAccounts(responses, connection);
    }
}
exports.getPackMintAccountsForWallet = getPackMintAccountsForWallet;

//return type https://solana-labs.github.io/solana-web3.js/modules.html#AccountInfo
const filterResponsesForSquadMintAccounts = async (responses, connection) => {
    responses = Array.from(responses);
    let mintAccounts = [];
    const [expectedCreator, _bump] = await getAuthPda();
    //response: {account: AccountInfo<Buffer>; pubkey: PublicKey }
    await Promise.all(responses.map(async (response) => {
        let mintKey = new PublicKey(response.account.data.slice(0, 32));
        if (await mintHasVerifiedCreator(mintKey, expectedCreator, connection)) {
            mintAccounts.push(response.account);
        }
    }));
    return mintAccounts
}

const getAuthPda = async () => {
    return await PublicKey.findProgramAddress(
        [anchor.utils.bytes.utf8.encode("authority")],
        PACK_PROGRAM_ID
    );
}

const getMetadataAddress = async (mintPubkey) => {
    return await anchor.web3.PublicKey.findProgramAddress(
        [
            Buffer.from("metadata"),
            TOKEN_METADATA_PROGRAM_ID.toBuffer(),
            mintPubkey.toBuffer(),
        ],
        TOKEN_METADATA_PROGRAM_ID
    );
}
exports.getMetadataAddress = getMetadataAddress;


exports.getAssociatedTokenAccountAddress = async (owner, mint) => {
    let associatedProgramId = new PublicKey('ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL');
    return (
        await PublicKey.findProgramAddress(
            [owner.toBuffer(), TOKEN_PROGRAM_ID.toBuffer(), mint.toBuffer()],
            associatedProgramId
        )
    )[0];
};

exports.createAssociatedTokenAccountInstruction = (
    mint,
    associatedAccount,
    owner,
    payer,
) => {
    const data = Buffer.alloc(0);
    let keys = [
        { pubkey: payer, isSigner: true, isWritable: true },
        { pubkey: associatedAccount, isSigner: false, isWritable: true },
        { pubkey: owner, isSigner: false, isWritable: false },
        { pubkey: mint, isSigner: false, isWritable: false },
        { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
        { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
        { pubkey: SYSVAR_RENT_PUBKEY, isSigner: false, isWritable: false },
    ];
    return new TransactionInstruction({
        keys,
        programId: ASSOCIATED_PROGRAM_ID,
        data,
    });
}

//returns Promise<{ account: AccountInfo<Buffer>; pubkey: PublicKey }
// this is running off of the metadata's verified creator
// "2" is base58 encoded hex value 01, representing true for verification of the creator
exports.fetchAllPackMintAccounts = async (connection) => {
    let [authPda, _bump] = await getAuthPda();
    //https://solana-labs.github.io/solana-web3.js/modules.html#MemcmpFilter
    let config = {
        filters: [
            {
                dataSize: 679
            },
            {
                memcmp:
                {
                    bytes: authPda.toBase58(),
                    offset: 326
                }
            },
            {
                memcmp:
                {
                    bytes: "2",
                    offset: 358
                }
            },
        ]
    }
    //https://solana-labs.github.io/solana-web3.js/classes/Connection.html#getProgramAccounts
    let accounts = await connection.getProgramAccounts(
        TOKEN_METADATA_PROGRAM_ID,
        config
    );
    return accounts;
}

const getMembersForPackMint = async (mintPubkey, connection) => {
    let TokenMint = new Token(
        connection,
        mintPubkey,
        TOKEN_PROGRAM_ID,
        Keypair.generate()
    );
    let largestAccounts = await connection.getTokenLargestAccounts(mintPubkey);
    let holders = Array.from(largestAccounts.value);

    //gets all owners into pubkey array
    let members = [];
    await Promise.all(holders.map(async (holder) => {
        let accountInfo = await TokenMint.getAccountInfo(holder.address);
        //console.log(accountInfo.owner);
        //type AccountInfo https://github.com/solana-labs/solana-program-library/blob/master/token/js/client/token.js#L149
        //it's a PublicKey
        members.push(accountInfo.owner);
    }));
    return members
}
exports.getMembersForPackMint = getMembersForPackMint;

exports.isWalletPackMember = async (walletPubkey, packMintPubkey, connection) => {
    walletPubkey = new PublicKey(walletPubkey);
    //members: [PublicKey]
    let isMember = false;
    let members = await getMembersForPackMint(packMintPubkey, connection);
    members.forEach((member) => {
        if (member.equals(walletPubkey)) {
            isMember = true;
        }
    });
    return [isMember, members]
}

exports.isPackEligibleForNewMembers = async (packMintPubkey, connection) => {
    let packTokenSupply = await connection.getTokenSupply(packMintPubkey);
    let supplyAmount = packTokenSupply.value.uiAmount;
    console.log("pack token supply is ", supplyAmount);
    if (Boolean(supplyAmount) && supplyAmount < 7) {
        return false
    }
    return true
}

exports.buildConnectedMembersDict = async (walletPubkey, connection) => {
    let packMints = await getPackMintKeysForWallet(walletPubkey, connection);
    let connectedMembers = {};
    //memberPubkey:[sharedpackmint]
    //console.log(packMints.length, " we got this many pack mints");
    await Promise.all(packMints.map(async (packMint) => {
        let members = await getMembersForPackMint(packMint, connection);
        members.forEach((member) => {
            let sharedPacks = connectedMembers[member];
            if (Boolean(sharedPacks)) {
                sharedPacks = Array.from(sharedPacks);
                sharedPacks.push(packMint);
                connectedMembers[member] = sharedPacks;
            } else {
                connectedMembers[member] = [packMint]
            }
        });
    }));
    return connectedMembers
}


//need to figure out the name service shit
//member will just be address or .sol name

//app will fetch pack members, retain this state for other uses
/*
    on pack page, we are going to start with packID, which is the mintkey for a pack

    from there

    (if wallet connected)
    1. has wallet joined? show update metadata
    2. can wallet join? let them join
    3. pack info

    if (isWalletPackMember) {
        update pack
    } else if (isPackEligibleForNewMembers) {
        join pack
    } else {
        pack info

    }

    (if wallet not connected)
    - pack info

    for pack info --
    - members
    - pack mint metadata


    for the pack info
    - name
    - symbol
    - image

    - members -- get the id


*/
