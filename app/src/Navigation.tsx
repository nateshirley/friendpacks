import { useWallet } from '@solana/wallet-adapter-react';
import { Link } from 'react-router-dom';
import { WalletDisconnectButton, WalletMultiButton } from '@solana/wallet-adapter-react-ui';
import React, { FC } from 'react';



const Navigation: FC = () => {
    const { wallet } = useWallet();

    return (
        <nav>
            <h1>Solana Starter App</h1>
            <div>
                <li><Link to="/">home</Link></li>
                <li><Link to="/stuff">stuff</Link></li>
                <li><Link to="/create">create</Link></li>
                <WalletMultiButton />
                {wallet && <WalletDisconnectButton />}
            </div>
        </nav>
    );
};

export default Navigation;
