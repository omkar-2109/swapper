import React, { useState, useEffect } from "react";
import {
  BitcoinNetwork,
  BitcoinWallet,
  BitcoinProvider,
  EVMWallet,
} from "@catalogfi/wallets";
import {
  Orderbook,
  Chains,
  Assets,
  Actions,
  parseStatus,
  TESTNET_ORDERBOOK_API,
} from "@gardenfi/orderbook";
import { GardenJS } from "@gardenfi/core";
import { ethers } from "ethers";

function App() {
  const [bitcoinWallet, setBitcoinWallet] = useState(null);
  const [evmWallet, setEvmWallet] = useState(null);
  const [signer, setSigner] = useState(null);
  const [bitcoinAddress, setBitcoinAddress] = useState("");
  const [bitcoinBalance, setBitcoinBalance] = useState(0);
  const [changeWalletStatus, setChangeWalletStatus] = useState({
    bitcoinWallet: false,
    evmWallet: false,
  });
  const [evmAddress, setEvmAddress] = useState("");
  const [evmBalance, setEvmBalance] = useState(0);
  const [reverseTransaction, setReverseTransaction] = useState(false);
  const [swapAmount, setSwapAmount] = useState(0);
  const [isSwapping, setIsSwapping] = useState(false);

  const connectBitcoinWallet = async () => {
    try {
      const bitcoinWallet = BitcoinWallet.fromWIF(
        "cTjvPzPjcCcdTNTftYpvJjjwbK2fnXqSv34jKurqM1hXTr9ed5tw",
        new BitcoinProvider(BitcoinNetwork.Testnet)
      );
      const balance = await bitcoinWallet.getBalance();
      setBitcoinBalance(balance / 1e8); // Convert satoshis to BTC
      const address = await bitcoinWallet.getAddress();
      setBitcoinAddress(address);
      setBitcoinWallet(bitcoinWallet);
      setChangeWalletStatus((prev) => ({ ...prev, bitcoinWallet: true }));
    } catch (error) {
      console.error("Error connecting Bitcoin wallet:", error);
    }
  };

  const connectEthereumWallet = async () => {
    try {
      const provider = new ethers.BrowserProvider(window.ethereum);
      await window.ethereum.request({ method: "eth_requestAccounts" });
      const signer = await provider.getSigner();
      const evmWallet = new EVMWallet(signer);
      setEvmWallet(evmWallet);
      setSigner(signer);
      const address = await signer.getAddress();
      setEvmAddress(address);
      
      const balance = await provider.getBalance(address);
      const ethBalance = parseFloat(ethers.formatEther(balance));
      setEvmBalance(ethBalance);
      
      setChangeWalletStatus((prev) => ({ ...prev, evmWallet: true }));
    } catch (error) {
      console.error("Error connecting Ethereum wallet:", error);
    }
  };

  const executeSwap = async () => {
    if (!bitcoinWallet || !evmWallet) {
      console.error("Both wallets must be connected to swap");
      return;
    }

    setIsSwapping(true);
    try {
      const orderbook = await Orderbook.init({
        url: TESTNET_ORDERBOOK_API,
        signer,
      });

      const wallets = {
        [Chains.bitcoin_testnet]: bitcoinWallet,
        [Chains.ethereum_sepolia]: evmWallet,
      };

      const garden = new GardenJS(orderbook, wallets);

      const sendAmount = swapAmount * 1e8; // Convert to satoshis
      const receiveAmount = (1 - 0.003) * sendAmount; // 0.3% fee

      const fromAsset = reverseTransaction ? Assets.ethereum_sepolia.WBTC : Assets.bitcoin_testnet.BTC;
      const toAsset = reverseTransaction ? Assets.bitcoin_testnet.BTC : Assets.ethereum_sepolia.WBTC;

      const orderId = await garden.swap(
        fromAsset,
        toAsset,
        sendAmount,
        receiveAmount
      );

      garden.subscribeOrders(await evmWallet.getAddress(), async (orders) => {
        const order = orders.find((o) => o.ID === orderId);
        if (!order) return;

        const action = parseStatus(order);

        if (action === Actions.UserCanInitiate || action === Actions.UserCanRedeem) {
          const swapper = garden.getSwap(order);
          const swapOutput = await swapper.next();
          console.log(`Completed Action ${swapOutput.action} with transaction hash: ${swapOutput.output}`);
        }
      });

      console.log("Swap initiated with orderId:", orderId);
    } catch (error) {
      console.error("Error executing swap:", error);
    } finally {
      setIsSwapping(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-100 flex items-center justify-center p-4">
      <div className="bg-white rounded-lg shadow-md w-full max-w-md p-6">
        <h2 className="text-2xl font-bold text-center mb-6">Crypto Swap</h2>
        
        <div className="mb-6 p-4 bg-gray-50 rounded-lg">
          <h3 className="text-lg font-semibold mb-2">Wallet Balances</h3>
          <div className="flex justify-between">
            <div>
              <p className="font-medium">BTC:</p>
              <p>{changeWalletStatus.bitcoinWallet ? `${bitcoinBalance.toFixed(8)} BTC` : 'Not connected'}</p>
            </div>
            <div>
              <p className="font-medium">ETH:</p>
              <p>{changeWalletStatus.evmWallet ? `${evmBalance.toFixed(4)} ETH` : 'Not connected'}</p>
            </div>
          </div>
        </div>

        <div className="space-y-6">
          <div className="flex justify-between">
            <button
              onClick={connectBitcoinWallet}
              disabled={changeWalletStatus.bitcoinWallet}
              className={`px-4 py-2 rounded-md w-[48%] ${
                changeWalletStatus.bitcoinWallet
                  ? "bg-gray-300 cursor-not-allowed"
                  : "bg-blue-500 hover:bg-blue-600 text-white"
              }`}
            >
              {changeWalletStatus.bitcoinWallet ? "BTC Connected" : "Connect BTC"}
            </button>
            <button
              onClick={connectEthereumWallet}
              disabled={changeWalletStatus.evmWallet}
              className={`px-4 py-2 rounded-md w-[48%] ${
                changeWalletStatus.evmWallet
                  ? "bg-gray-300 cursor-not-allowed"
                  : "bg-blue-500 hover:bg-blue-600 text-white"
              }`}
            >
              {changeWalletStatus.evmWallet ? "ETH Connected" : "Connect ETH"}
            </button>
          </div>

          <div className="space-y-2">
            <div className="flex justify-between items-center">
              <span className="text-sm font-medium">
                {reverseTransaction ? "WBTC to BTC" : "BTC to WBTC"}
              </span>
              <div className="flex items-center space-x-2">
                <span className="text-sm">Reverse</span>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input type="checkbox" className="sr-only peer" checked={reverseTransaction} onChange={() => setReverseTransaction(!reverseTransaction)} />
                  <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 dark:peer-focus:ring-blue-800 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-blue-600"></div>
                </label>
              </div>
            </div>
            <input
              type="number"
              value={swapAmount}
              onChange={(e) => setSwapAmount(parseFloat(e.target.value))}
              placeholder={reverseTransaction ? "WBTC Amount" : "BTC Amount"}
              className="w-full px-3 py-2 text-lg border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <button
            onClick={executeSwap}
            disabled={isSwapping || !changeWalletStatus.bitcoinWallet || !changeWalletStatus.evmWallet}
            className={`w-full px-4 py-2 ${
              isSwapping || !changeWalletStatus.bitcoinWallet || !changeWalletStatus.evmWallet
                ? "bg-gray-300 cursor-not-allowed"
                : "bg-green-500 hover:bg-green-600 text-white"
            } rounded-md`}
          >
            {isSwapping ? "Swapping..." : "Swap"}
          </button>

          {(changeWalletStatus.bitcoinWallet || changeWalletStatus.evmWallet) && (
            <div className="bg-blue-100 border-l-4 border-blue-500 text-blue-700 p-4" role="alert">
              <p className="font-bold">Wallets Connected</p>
              {changeWalletStatus.bitcoinWallet && (
                <p>Bitcoin: {bitcoinAddress.slice(0, 6)}...{bitcoinAddress.slice(-4)}</p>
              )}
              {changeWalletStatus.evmWallet && (
                <p>Ethereum: {evmAddress.slice(0, 6)}...{evmAddress.slice(-4)}</p>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default App;