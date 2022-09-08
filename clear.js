const mongoose = require('mongoose');

const { Interface } = require("@ethersproject/abi");
const { Contract, providers, ethers } = require("ethers");
const { readFileSync } = require("fs");

const NftRecord = require('./schema');
const NftItem = require('./models/NftItem');


const chainId = process.argv[2];
const address = process.argv[3].toLowerCase();


console.log('address: ', address);

// mongoose.connect('mongodb://127.0.0.1:27017');

async function clear() {
  const db = mongoose.connection;

  await NftItem.deleteMany({
    contract: address,
    chainId: chainId
  });

  console.log('--- finished ---');

  return mongoose.disconnect();
}

mongoose.connect('mongodb://127.0.0.1:27017').then(clear);
