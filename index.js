const express = require('express');
const { readFileSync, writeFileSync, renameSync } = require('fs');
const { ethers, Wallet } = require('ethers');
const { default: mongoose } = require('mongoose');
const config = require('./config');

const Collection = require('./models/Collection');

const multer = require("multer");
const upload = multer({ dest: "uploads/", limits: {fileSize: 100*1024*1024} });

var cors = require('cors');

const { Contract, utils, providers } = ethers;


const NFT_ADDR = '0x9B1702011c498fB6b61e308e8D74553f413F7291';
const ROOS_ADDR = '0xb67596828aC3cB4E65C170C0d66806Ac7bEB00C0';
const RPC_URL = 'https://evm.cronos.org';
const nftAbi = JSON.parse(readFileSync('./abis/nft.json'));

const NftRecord = require('./schema');
const path = require('path');
const NftItem = require('./models/NftItem');
const Property = require('./models/Property');
const { solidityKeccak256, verifyMessage, arrayify, recoverAddress } = require('ethers/lib/utils');

const provider = new providers.JsonRpcProvider(RPC_URL);
const verifier = new Wallet(config.privKey);

// provider.getTransaction('0x0f7167cdfa05175cead6345b6b7ab95b5fd1fa725d6d4b68b02278f0f881e654')
//   .then(function(tx) {
//     console.log('tx -- ', tx);
//   }).catch(function(e) {
//     console.error(e);
//   });

mongoose.connect('mongodb://127.0.0.1:27017');

const app = express();

app.use('/uploads', express.static('uploads'));

var corsOptions = {
  origin: ['https://hopswap.com', 'http://localhost:3000'],
  optionsSuccessStatus: 200 // some legacy browsers (IE11, various SmartTVs) choke on 204
}
// app.use(cors());
app.use(cors(corsOptions));

function isEqAddr(a, b) {
  return a.toLowerCase() === b.toLowerCase();
}

async function renameFile(file) {
  try {
    const ext = file.originalname.split('.').pop();
    await renameSync(file.path, file.path + '.' + ext);
    return (file.path + '.' + ext).replace("\\", "/");
  } catch(e) {
    console.error(e);
    return false;
  }
}

app.post('/create', upload.array("image"), async (req, res) => {
  const path = await renameFile(req.files[0]);

  const owner = req.body['address'];

  const signer = ethers.utils.verifyMessage("HopSwap NFT Marketplace: Create Item\n\n" + owner, req.body['signature']);

  if (!isEqAddr(signer, owner)) {
    return res.status(401).json({error: true, message: 'Fuck off!'});
  }

  if (!req.body['name'] || !path) {
    return res.status(500).json({error: true});
  }

  const result = await new NftItem({
    name: req.body['name'],
    collectionId: req.body['collection'],
    owner: owner,
    tokenId: 0,
    imageUrl: path,
    description: req.body['description'],
    link: req.body['link'],
    listed: false,
    price: null,
    minted: false,
    sensitive: req.body['sensitive'] === 'true',
    lastSold: 0,
    created: Math.floor(new Date().getTime() / 1000),
    likes: 0
  }).save();

  const props = JSON.parse(req.body['properties']);
  for (var i = 0; i < props.length; i++) {
    if (props[i]['key'] && props[i]['value']) {
      await new Property({
        collectionId: req.body['collection'],
        nftId: result._id,
        key: props[i]['key'],
        value: props[i]['value']
      }).save();
    }
  }

  if (result) {
    const data = solidityKeccak256(['address', 'string'], [owner, result._id.toString()]);
    const signature = await verifier.signMessage(arrayify(data));

    res.json({
      success: true,
      id: result._id,
      signature: signature
    });
  } else {
    res.status(500).json({error: true, message: 'Something went wrong!'});
  }
});

app.post('/delete', upload.array(), async (req, res) => {
  const {user, item, signature} = req.body;

  const data = solidityKeccak256(['address', 'string'], [user, item]);

  if (verifyMessage(arrayify(data), signature) != verifier.address) {
    return res.status(500).json({});
  }

  await NftItem.deleteOne({_id: item}).exec();
  return res.json({success: true});
});

app.post('/minted', upload.array(), async (req, res) => {
  const {user, item, signature, txHash} = req.body;

  const data = solidityKeccak256(['address', 'string'], [user, item]);

  if (verifyMessage(arrayify(data), signature) != verifier.address) {
    return res.status(500).json({});
  }

  const nftItem = await NftItem.findById(item).exec();

  if (nftItem) {
    await Collection.findOneAndUpdate({_id: nftItem['collection']}, {
      $inc: {items: 1}
    }).exec();

    nftItem.minted = true;
    await nftItem.save();
  }

  return res.json({success: true});
});

app.post('/list', upload.array(), async (req, res) => {
  const {item, signature, price} = req.body;

  const nftItem = await NftItem.findById(item);
  if (!nftItem) {
    return res.status(404).send({error: true});
  }

  const signer = verifyMessage("List NFT\nItem: " + item + "\nPrice: " + price, signature);
  if ( !isEqAddr(signer, nftItem.owner) ) {
    return res.status(401).send({error: true});
  }

  nftItem.listed = true;
  nftItem.price = price;
  await nftItem.save();

  return res.json({success: true});
});

app.post('/create-collection', upload.fields([
  { name: 'logo', maxCount: 1 },
  { name: 'banner', maxCount: 1 },
  { name: 'fimage', maxCount: 1 }
]), async (req, res) => {

  const logo = req.files['logo']? await renameFile(req.files['logo'][0]) : null;
  const banner = req.files['banner']? await renameFile(req.files['banner'][0]) : null;
  const fimage = req.files['fimage']? await renameFile(req.files['fimage'][0]) : null;

  const owner = req.body['address'];

  const address = ethers.utils.verifyMessage("HopSwap NFT Marketplace: Create new collection\n\n" + owner,
    req.body['signature']);

  if (address.toLowerCase() !== owner.toLowerCase()) {
    return res.status(401).json({error: true, message: 'Fuck off!'});
  }

  const result = await new Collection({
    contract: '',
    creator: owner,
    owner: owner,
    logoUrl: logo,
    bannerImgUrl: banner,
    featuredImgUrl: fimage,
    name: req.body['name'],
    description: req.body['description'],
    socialLinks: req.body['socialLinks'],
    creatorFee: parseFloat(req.body['creatorFee']),
    category: req.body['category'],
    sensitive: req.body['sensetive'] === 'true'
  }).save();

  if (result) {
    res.json({
      success: true,
      id: result._id
    });
  } else {
    res.status(500).json({error: true, message: 'Something went wrong!'});
  }
});

app.get('/collections/:account', async (req, res) => {
  const {account} = req.params;

  try {
    const result = await Collection.find({owner: account});

    res.json(result);
  } catch(e) {
    console.error(e);
    res.status(500).send({error: true});
  }
});

app.get('/collection/:id', async (req, res) => {
  const {id} = req.params;

  try {
    const result = await Collection.findById(id);
    const items = await NftItem.find({
      collectionId: id
    }).sort({created: 'desc', lastSold: 'desc'}).limit(120);

    res.json({data: result, items: items, success: true});
  } catch(e) {
    console.error(e);
    res.status(500).send({error: true});
  }
});

app.get('/nfts/:user', async (req, res) => {
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

app.get('/items', async (req, res) => {

  let {sortBy, search, minPrice, maxPrice, state, from, num} = req.query;

  let sort = {likes: -1, lastSold: -1, created: -1};
  from = from || 0;
  num = num || 120;

  if (sortBy == 'recent-sold') sort = {lastSold: -1};
  else if (sortBy == 'recent-listed') sort = {created: -1};
  else if (sortBy == 'price-high') sort = {price: -1};
  else if (sortBy == 'price-low') sort = {price: 1};

  let filter = {};
  if (search) {
    filter.name = {$regex: `${search}`, $options: "i"};
  }

  let states = state? state.split('+') : [];
  if (states.indexOf('sale') >= 0) filter.listed = true;
  if (states.indexOf('auction') >= 0) filter.inAuction = true;

  if (minPrice || maxPrice) {
    filter.price = {};
    if (minPrice) {
      filter.price.$gte = minPrice;
    }
    if (maxPrice) {
      filter.price.$lte = maxPrice;
    }
  }
  
  try {
    const count = await NftItem.count(filter);
    const items = await NftItem.find(filter).sort(sort).skip(from).limit(num).exec();

    res.json({count, items});
  } catch(e) {
    console.error(e);
    res.status(500).json({error: true});
  }
})

app.get('/item/:id', async (req, res) => {
  const {id} = req.params;

  try {
    const result = await NftItem.findById(id);
    const collection = await Collection.findById(result.collectionId);

    res.json({item: result, collection, success: true});
  } catch(e) {
    console.error(e);
    res.status(500).send({error: true});
  }
});


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