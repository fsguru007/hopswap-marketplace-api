const mongoose = require('mongoose');

const { Interface } = require("@ethersproject/abi");
const { Contract, providers, ethers } = require("ethers");
const { readFileSync } = require("fs");

const NftRecord = require('./schema');


const address = process.argv[2].toLowerCase();


console.log('address: ', address);

// mongoose.connect('mongodb://127.0.0.1:27017');

async function clear() {
  const db = mongoose.connection;

  await NftRecord.deleteMany({
    nft: address
  });

  console.log('--- finished ---');

  return mongoose.disconnect();
}

mongoose.connect('mongodb://127.0.0.1:27017').then(clear);
