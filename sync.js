const mongoose = require('mongoose');

const { Interface } = require("@ethersproject/abi");
const { Contract, providers, ethers } = require("ethers");
const { readFileSync } = require("fs");

const NftRecord = require('./schema');

const mcAbi = JSON.parse(readFileSync('./abis/multicall.json'));

const RPC_URL = "https://rpc.artemisone.org/cronos";

const address = process.argv[2].toLowerCase();

const multicallAddress = "0xD3d44340b93F6f7aB85bB8FadDC8E3a155B39051";

const provider = new providers.JsonRpcProvider(RPC_URL);

const mcContract = new Contract(multicallAddress, mcAbi, provider);


const nftAbi = JSON.parse(readFileSync('./abis/nft.json'));
const nftContract = new Contract(address, nftAbi, provider);
const nftItf = new Interface(nftAbi);

console.log('address: ', address);

// mongoose.connect('mongodb://127.0.0.1:27017');

async function sync() {
  const db = mongoose.connection;

  const totalSupply = await nftContract.totalSupply();

  console.log('totalSupply: ', totalSupply);

  for (var i = 1; i <= totalSupply; i+=10) {
    const calls = [];
    for (var j = i; j < i + 10 && j < totalSupply; j++) {
      calls.push([
        address, nftItf.encodeFunctionData('ownerOf', [j])
      ]);
    }

    const [bn, data] = await mcContract.aggregate(calls);
    for (var k = 0; k < data.length; k++) {
      const res = await NftRecord.findOneAndUpdate({
        nft: address,
        id: i + k
      }, {
        $set: { owner: nftItf.decodeFunctionResult('ownerOf', data[k])[0].toLowerCase() }
      }, {
        upsert: true, new: true
      });

      console.log(res);
    }
  }

  console.log('--- finished ---');

  return mongoose.disconnect();
}

mongoose.connect('mongodb://127.0.0.1:27017').then(sync);
