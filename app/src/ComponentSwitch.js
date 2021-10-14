import { clusterApiUrl, Connection } from '@solana/web3.js';
import { Provider } from '@project-serum/anchor';
import { useWallet } from '@solana/wallet-adapter-react';
import { Route, Switch } from 'react-router-dom';
import Home from './components/Home';
import Create from './components/Create';
import Find from './components/Find/Find';



const ComponentSwitch = () => {

  let wallet = useWallet()
  const opts = {
    preflightCommitment: "processed"
  }
  const getProvider = () => {
    const network = clusterApiUrl('devnet');
    const connection = new Connection(network, opts.preflightCommitment);
    const provider = new Provider(
      connection, wallet, opts.preflightCommitment,
    );
    return provider;
  }

  return (
    <Switch>
      <Route path="/make" render={(props) => (
        <Create {...props} getProvider={getProvider} />
      )} />
      <Route path="/find" render={(props) => (
        <Find {...props} getProvider={getProvider} />
      )} />
      <Route exact path="/" component={Home} />
    </Switch>
  );

}

export default ComponentSwitch;