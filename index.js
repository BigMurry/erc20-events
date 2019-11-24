const ethers = require('ethers');
const _ = require('lodash');
const traverse = require('traverse');
const BN = require('bignumber.js');

const PROVIDER_URL = '';
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

function eventNameToTopic(abi, eventName) {
  const inter = new ethers.utils.Interface(abi);
  const evt = inter.events[eventName];
  return _.get(evt, ['topic']);
}

function formatEventValues(values, precision = 1e0) {
  const trimValues = Object.keys(values).reduce((ret, k) => {
    if (!/^\d+$/.test(k) && k !== 'length') {
      ret[k] = values[k];
    }
    return ret;
  }, {});
  const ret = traverse(trimValues).map(function(v) {
    if (v instanceof ethers.utils.BigNumber) {
      const bn = new BN(v.toString()).dividedBy(precision);
      this.update(bn.toString());
    }
  });
  return ret;
}

// entry
async function getLog(fromBlock, toBlock) {
  // create provider
  const rpcProvider = new ethers.providers.JsonRpcProvider(PROVIDER_URL);

  // create contract instance
  const usdtContractInstance = new ethers.Contract(
    USDT_CONF.networks['1'].address,
    USDT_CONF.abi,
    rpcProvider
  );
  const eventsConf = {
    address: USDT_CONF.networks[1].address,
    fromBlock,
    toBlock
  };

  // fetch the raw logs
  const logs = await rpcProvider.getLogs(eventsConf);
  // console.log(logs);

  const transferEventTopic = eventNameToTopic(USDT_CONF.abi, 'Transfer');
  // console.log(transferEventTopic);

  // filter and parse the logs to events
  const filterTopics = [transferEventTopic];
  const transferEvents = logs.filter(log => {
    return log && log.topics && _.intersection(log.topics, filterTopics).length > 0; // filter the transfer events only
  }).map(log => {
    const evt = usdtContractInstance.interface.parseLog(log);
    const usdPrecision = 1e6;
    return {
      txHash: log.transactionHash,
      logIdx: log.logIndex,
      blockNumber: log.blockNumber,
      blockHash: log.blockHash,
      contract: log.address,
      eventName: evt.name,
      topics: log.topics,
      rawValues: evt.values,
      values: formatEventValues(evt.values, usdPrecision)
    };
  });

  return transferEvents;
}

// run and test
const fromBlock = 8965690;
const toBlock = 8965695;
getLog(fromBlock, toBlock).then(events => console.log(events)).catch(e => console.log(e));
