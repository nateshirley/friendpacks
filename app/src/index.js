import React, {StrictMode} from 'react';
import ReactDOM from 'react-dom';
import './index.css';
import reportWebVitals from './reportWebVitals';
import { BrowserRouter } from 'react-router-dom';
import Wallet from './Wallet';

require('@solana/wallet-adapter-react-ui/styles.css');
require('bootstrap/dist/css/bootstrap.min.css');
require('./index.css');

ReactDOM.render(
  <StrictMode>
    <BrowserRouter>
        <Wallet />
    </BrowserRouter>
  </StrictMode>,
  document.getElementById('root')
);

// If you want to start measuring performance in your app, pass a function
// to log results (for example: reportWebVitals(console.log))
// or send to an analytics endpoint. Learn more: https://bit.ly/CRA-vitals
reportWebVitals();


/*

so it's like

Router
--> Wallet
-------> Navbar
-------> Switch

*/