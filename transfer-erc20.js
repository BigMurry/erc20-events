require('regenerator-runtime'); // ledgerhq issue hotfix
const ethers = require('ethers');
const Eth = require('@ledgerhq/hw-app-eth').default;
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
    '4': { // rinkeby pow testnet
      'block': 5472000, // initial block number for rinkebby ropsten testnet
      'address': '0x7cc3489C1A2887991D443B05a44A2f260998AdaD'
    },
    '5': { // goerli poa testnet
      'block': 1318894, // initial block number for goerli testnet
      'address': '0xaCCEd4e43D89177de0b77fD4C0f53ac215F02627'
    }
  }
};

const NETWORKS = {
  1: 'homestead',
  3: 'ropsten',
  4: 'rinkeby',
  5: 'goerli'
};

const USDT_TRANSFER_GAS_LIMIT = '0x015f90'; // 90,000 gas limit

function getCalldata(abi, method, args) {
  const fn = new ethers.utils.Interface(abi).functions[method];
  if (!fn) throw new Error(`method[${method}] not found.`);
  const calldata = fn.encode(args);
  // console.log(calldata);
  return calldata;
}

function getRawTx(to, usdtAmount, nonce, gasGwei, chainId = 1) { // default mainnet
  // usdt transfer calldata
  const calldata = getCalldata(USDT_CONF.abi, 'transfer', [to, usdtAmount]);

  const rawTx = {
    nonce: ethers.utils.hexlify('0x' + Number(nonce).toString(16)),
    gasPrice: ethers.utils.parseUnits(gasGwei + '', 'gwei'),
    gasLimit: USDT_TRANSFER_GAS_LIMIT,
    to: USDT_CONF.networks[chainId].address,
    value: '0x00',
    chainId,
    data: calldata
  };
  // console.log(rawTx);
  const txHex = ethers.utils.serializeTransaction(rawTx);
  // console.log(txHex);
  return {rawTx, txHex};
}

async function transfer() {
  const chainId = 4; // rinkeby
  const keyPath = "44'/60'/0'/0/0"; // ledger wallet key path
  const provider = ethers.getDefaultProvider(NETWORKS[chainId]); // infura public provider
  // const provider = new ethers.providers.JsonRpcProvider(PROVIDER_URL); // or pass provider custom URL here

  const transport = await TransportNodeHid.create();
  // console.log(transport);

  const eth = new Eth(transport);
  const {address: from} = await eth.getAddress(keyPath);
  console.log(`from: ${from}`);

  const to = '0x2A0d2127173809f4E63517D71e8083Fe6a1410eD';
  const usdtAmount = 10; // 10 usdt
  const gasGwei = 10; // 10gwei gas price
  const nonce = await provider.getTransactionCount(from);
  const {rawTx, txHex} = getRawTx(
    to,
    new BN(usdtAmount).times(1e6).toString(), // usdt to 6 decimals
    nonce,
    gasGwei,
    chainId
  );
  const {r, s, v} = await eth.signTransaction(keyPath, txHex.slice(2));
  const signedTx = ethers.utils.serializeTransaction(rawTx, {
    r: `0x${r}`,
    s: `0x${s}`,
    v: `0x${v}`
  });

  // broadcast tx to network
  const tx = await provider.sendTransaction(signedTx);
  console.log(`tx sent, check with: https://rinkeby.etherscan.io/tx/${tx.hash}`);

  // wait for tx confirm
  console.log('now wait for confirm...');
  const reciept = await tx.wait();
  console.log('tx confirmed!');

  return reciept;
}

transfer().then(tx => console.log(tx)).catch(e => console.log(e));
