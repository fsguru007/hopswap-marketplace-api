const express = require('express');
const { readFileSync, writeFileSync } = require('fs');
const { ethers } = require('ethers');
const { default: mongoose } = require('mongoose');

var cors = require('cors');

const { Contract, utils, providers } = ethers;

// const NFT_ADDR = '0x248b8F1580Def0Bf418a68730311Ef5CD8F5861F';
// const RPC_URL = 'https://rinkeby.infura.io/v3/9aa3d95b3bc440fa88ea12eaa4456161';
// const nftAbi = JSON.parse(readFileSync('./abi/nft.json'));

const NFT_ADDR = '0x9B1702011c498fB6b61e308e8D74553f413F7291';
const ROOS_ADDR = '0xb67596828aC3cB4E65C170C0d66806Ac7bEB00C0';
const RPC_URL = 'https://rpc.artemisone.org/cronos';
const nftAbi = JSON.parse(readFileSync('./abis/nft.json'));

const NftRecord = require('./schema');

const provider = new providers.JsonRpcProvider(RPC_URL);

const nftContract = new Contract(NFT_ADDR, nftAbi, provider);

const roosContract = new Contract(ROOS_ADDR, nftAbi, provider);

mongoose.connect('mongodb://127.0.0.1:27017');
nftContract.on('Transfer', async (from, to, tokenId, event) => {
  console.log(`Gopher Transfer: #${tokenId}, from ${from} to ${to}`);

  try {
    await NftRecord.findOneAndUpdate({
      nft: NFT_ADDR.toLowerCase(),
      id: tokenId
    }, {
      $set: { owner: to.toLowerCase() }
    }, {
      upsert: true, new: true
    });
  } catch(e) {
    console.error(e);
  }
});

roosContract.on('Transfer', async (from, to, tokenId, event) => {
  console.log(`Roos Transfer: #${tokenId}, from ${from} to ${to}`);

  try {
    await NftRecord.findOneAndUpdate({
      nft: ROOS_ADDR.toLowerCase(),
      id: tokenId
    }, {
      $set: { owner: to.toLowerCase() }
    }, {
      upsert: true, new: true
    });
  } catch(e) {
    console.error(e);
  }
});

const app = express();

var corsOptions = {
  origin: 'https://hopswap.finance',
  optionsSuccessStatus: 200 // some legacy browsers (IE11, various SmartTVs) choke on 204
}

app.get('/nfts/:user', cors(corsOptions), async (req, res) => {
    // res.send('Well done! ' + req.params.id);

    const {user} = req.params;

    if (user) {

      // await mongoose.connect('mongodb://127.0.0.1:27017');

      const nfts = await NftRecord.find({
        owner: user.toLowerCase()
      }).exec();

      // mongoose.disconnect();

      res.json(nfts);
      return;
    }

    res.json({
      error: true,
      message: 'Invalid request!'
    });
})

app.get('/check', async (req, res) => {
    // res.send('Well done! ' + req.params.id);

    res.json({
      message: 'Working, but silence is golden!'
    });
})

const PORT = 3300;

app.listen(PORT, '0.0.0.0', () => {
  console.log(`The application is listening on port ${PORT}!`);
})