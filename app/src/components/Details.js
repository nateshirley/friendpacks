import { Connection, PublicKey, clusterApiUrl, Provider } from '@solana/web3.js';
const { isWalletPackMember, isPackEligibleForNewMembers } = require('../modules/queries.js');

//first just get the data
//so we have a mint key
//we need token metadata, supply, and members


const Details = (props) => {


  const { getProvider } = props;

  async function getDetails() {

    let provider = await getProvider();
    console.log(provider);
    let myWalletPubkey = new PublicKey("5J8jLVz5YY5uc9sJuWtx42VVMUanLGYWoPXMRu7GsNEJ");
    let samplePackMint = new PublicKey("5q8E6jMNHTjzWRGkeUom7Q8uKgL6rgVdxuMmuePNXwQQ");
    // let members = await getMembersForPackMint(mint, provider.connection);
    let [isMember, members] = await isWalletPackMember(myWalletPubkey, samplePackMint, provider.connection);
    console.log("is wallet member? ", isMember);
    console.log("number of members: ", members.length);

    //could also do mint authority but fuck it 
    let isPackFull = await isPackEligibleForNewMembers(samplePackMint, provider.connection);
    console.log("is pack full?", isPackFull);
  }

  return (
    <div>
      <h2>Details</h2>
      <p>show some details</p>
      <ol>
        <li>Nulla pulvinar diam</li>
        <li>Facilisis bibendum</li>
        <li>Vestibulum vulputate</li>
        <li>Eget erat</li>
        <li>Id porttitor</li>
      </ol>
      <button onClick={getDetails}>test details</button>
    </div>
  );
}

export default Details;