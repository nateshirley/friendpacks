import { clusterApiUrl, Connection } from '@solana/web3.js';
import { Provider } from '@project-serum/anchor';
import { useWallet } from '@solana/wallet-adapter-react';
import { Route, Switch } from 'react-router-dom';
import Join from './components/Join';
import Details from './components/Details';
import Stuff from './components/Stuff';
import Home from './components/Home';
import Create from './components/Create';



const ComponentSwitch = () => {

  let wallet = useWallet()
  const opts = {
    preflightCommitment: "processed"
  }
  const getProvider = async () => {
    const network = clusterApiUrl('devnet');
    const connection = new Connection(network, opts.preflightCommitment);
    const provider = new Provider(
      connection, wallet, opts.preflightCommitment,
    );
    return provider;
  }

  return (
    <Switch>
      <Route path="/join" component={Join} />
      <Route path="/details" render={(props) => (
        <Details {...props} getProvider={getProvider} />
      )} />
      <Route path="/create" render={(props) => (
        <Create {...props} getProvider={getProvider} />
      )} />
      <Route path="/stuff" component={Stuff} />
      <Route exact path="/" component={Home} />
    </Switch>
  );

}

export default ComponentSwitch;