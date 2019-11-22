const ethers = require('ethers');
const Tx = require('ethereumjs-tx');
require('regenerator-runtime');
const Eth = require('@ledgerhq/hw-app-eth');
const TransportNodeHid = require('@ledgerhq/hw-transport-node-hid').default;
const BN = require('bignumber.js');

const USDT_CONF = {
  // human readable abi
  abi: [
    // view methods
    'function totalSupply() view returns (uint totalSupply)',
    'function balanceOf(address who) view returns (uint balance)',
    'function allowance(address owner, address spender) view returns (uint allowance)',

    // transaction methods
    'function transfer(address to, uint value)',
    'function transferFrom(address from, address to, uint value)',
    'function approve(address spender, uint value)',

    // events
    'event Transfer(address indexed from, address indexed to, uint value)',
    'event Approval(address indexed owner, address indexed spender, uint value)'
  ],

  // contract address
  networks: {
    '1': { // mainnet
      'block': 4634748, // initial block number for mainnet
      'address': '0xdac17f958d2ee523a2206206994597c13d831ec7'
    },
    '3': { // ropsten pow testnet
      'block': 6414181, // initial block number for ropsten testnet
      'address': '0x7A434FBdAca6D9Bee580FE2c285c9859BC63FB67'
    },
    '5': { // goerli poa testnet
      'block': 1318894, // initial block number for goerli testnet
      'address': '0xaCCEd4e43D89177de0b77fD4C0f53ac215F02627'
    }
  }
};

const USDT_TRANSFER_GAS_LIMIT = '0x15f90'; // 90,000 gas limit

function getCalldata(abi, method, args) {
  const fn = new ethers.utils.Interface(abi).functions[method];
  if (!fn) throw new Error(`method[${method}] not found.`);
  const calldata = fn.encode(args);
  // console.log(calldata);
  return calldata;
}

function getRawTx(to, usdtAmount, nonce, gasGwei, chainId = 1) { // default mainnet
  const calldata = getCalldata(USDT_CONF.abi, 'transfer', [to, usdtAmount]);

  const rawTx = {
    nonce: '0x' + Number(nonce).toString(16),
    gasPrice: '0x' + ethers.utils.parseUnits(gasGwei, 'gwei'),
    gasLimit: USDT_TRANSFER_GAS_LIMIT,
    to: USDT_CONF.networks[chainId].address,
    value: '0x00',
    chainId,
    r: '0x00',
    s: '0x00',
    v: `0x0${chainId}`, // note: https://github.com/LedgerHQ/ledgerjs/issues/43#issuecomment-366984725
    data: '0x' + calldata
  };
  const txToSign = new Tx(rawTx).serialize().toString('hex');
  console.log(txToSign);

  return txToSign;
}

async function transfer() {
  const provider = ethers.getDefaultProvider(); // mainnet infura provider
  const transport = await TransportNodeHid.create();
  console.log(transport);

  const eth = new Eth(transport);
  const keyPath = "44'/60'/0'/0/0";
  const from = '0x1b6e35b91cBF70098D22757435Cbf6151B5C061B';
  const to = '0x2A0d2127173809f4E63517D71e8083Fe6a1410eD';
  const usdtAmount = 100; // 100 usdt
  const gasGwei = 10; // 10gwei gas price
  const chainId = 4; // rinkeby
  const nonce = await provider.getTransactionCount(from);
  const rawTx = getRawTx(
    to,
    new BN(usdtAmount).times(1e6).toString(), // usdt to 6 decimals
    nonce,
    gasGwei,
    chainId
  );
  const sig = await eth.signTransaction(keyPath, rawTx);

  const signedTx = Object.assign({}, rawTx, {
    r: sig.r,
    s: sig.s,
    v: sig.v
  });
  const tx = await provider.sendTransaction(signedTx);
  return tx;
}

transfer().then(tx => console.log(tx)).catch(e => console.log(e));
