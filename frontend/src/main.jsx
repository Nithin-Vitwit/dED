import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import 'bootstrap/dist/css/bootstrap.min.css';
import '@solana/wallet-adapter-react-ui/styles.css';
import './index.css'
import './marketplace.css'

import WalletContextProvider from './providers/WalletContextProvider.jsx';

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <WalletContextProvider>
      <App />
    </WalletContextProvider>
  </React.StrictMode>,
)
