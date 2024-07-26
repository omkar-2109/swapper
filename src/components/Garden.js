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
  TESTNET_ORDERBOOK_API
} from "@gardenfi/orderbook";
import { GardenJS } from "@gardenfi/core";
import { JsonRpcProvider, Wallet } from "ethers";

// Option 1: Create a bitcoin wallet from a private key
const bitcoinWallet = BitcoinWallet.fromPrivateKey(
  "tb1q8eamvjqvq4fdaqmzxfs6936ec96flp90unc7cm",
  new BitcoinProvider(BitcoinNetwork.Mainnet)
);

// Option 2: Create a bitcoin wallet from a WIF key
const bitcoinWallet = BitcoinWallet.fromWIF(
  "Your WIF",
  new BitcoinProvider(BitcoinNetwork.Mainnet)
);

// create your evm wallet
const signer = new Wallet("Your PK", new JsonRpcProvider("https://rpc.ankr.com/eth"));
const evmWallet = new EVMWallet(signer);

(async () => {
  const orderbook = await Orderbook.init({
    url: TESTNET_ORDERBOOK_API, // add this line only for testnet
    signer,
  });

  const wallets = {
    [Chains.bitcoin]: bitcoinWallet,
    [Chains.ethereum]: evmWallet,
  };

  const garden = new GardenJS(orderbook, wallets);

  const sendAmount = 0.0001 * 1e8;
  const receiveAmount = (1 - 0.3 / 100) * sendAmount;

  const orderId = await garden.swap(
    Assets.bitcoin.BTC,
    Assets.ethereum.WBTC,
    sendAmount,
    receiveAmount
  );

  garden.subscribeOrders(await evmWallet.getAddress(), async (orders) => {
    const order = orders.filter((order) => order.ID === orderId)[0];
    if (!order) return;

    const action = parseStatus(order);

    if (action === Actions.UserCanInitiate || action === Actions.UserCanRedeem) {
      const swapper = garden.getSwap(order);
      const swapOutput = await swapper.next();
      console.log(
        `Completed Action ${swapOutput.action} with transaction hash: ${swapOutput.output}`
      );
    }
  });
})();