const express = require('express');
const { readFileSync, writeFileSync, renameSync } = require('fs');
const { ethers } = require('ethers');
const { default: mongoose } = require('mongoose');

const multer = require("multer");
const upload = multer({ dest: "uploads/", limits: {fileSize: 100*1024*1024} });

var cors = require('cors');

const { Contract, utils, providers } = ethers;


const NFT_ADDR = '0x9B1702011c498fB6b61e308e8D74553f413F7291';
const ROOS_ADDR = '0xb67596828aC3cB4E65C170C0d66806Ac7bEB00C0';
const RPC_URL = 'https://rpc.artemisone.org/cronos';
const nftAbi = JSON.parse(readFileSync('./abis/nft.json'));

const NftRecord = require('./schema');

const provider = new providers.JsonRpcProvider(RPC_URL);


mongoose.connect('mongodb://127.0.0.1:27017');

const app = express();

var corsOptions = {
  origin: ['https://hopswap.finance','http://localhost:3000'],
  optionsSuccessStatus: 200 // some legacy browsers (IE11, various SmartTVs) choke on 204
}

app.post('/create', cors(corsOptions), upload.array("image"), async (req, res) => {
  console.log(req.body);
  console.log('files -- ', req.files);

  for (var i = 0; i < req.files.length; i++) {
    const ext = req.files[i].originalname.split('.').pop();
    await renameSync(req.files[i].path, req.files[i].path + '.' + ext);
  }

  res.json({
    success: true
  });
});

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