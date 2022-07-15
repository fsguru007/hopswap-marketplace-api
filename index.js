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


const NFT_ADDR = '0xd4669F8e6C7c375535596A088b315b551adeF191';
const ROOS_ADDR = '0xb67596828aC3cB4E65C170C0d66806Ac7bEB00C0';
const RPC_URL = 'https://evm.cronos.org';
const nftAbi = JSON.parse(readFileSync('./abis/nft.json'));

const NftRecord = require('./schema');
const path = require('path');
const NftItem = require('./models/NftItem');
const Property = require('./models/Property');
const { solidityKeccak256, verifyMessage, arrayify, recoverAddress, Interface, parseEther } = require('ethers/lib/utils');
const User = require('./models/User');

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

function unixTs() {
  return Math.floor(new Date().getTime() / 1000);
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

  const signer = ethers.utils.verifyMessage("HopSwap NFT Marketplace: Create Item\n\n" + owner + "\nChainID: " + req.body['chainId'], req.body['signature']);

  if (!isEqAddr(signer, owner)) {
    return res.status(401).json({error: true, message: 'Fuck off!'});
  }

  if (!req.body['name'] || !path) {
    return res.status(500).json({error: true});
  }

  try {
    const result = await new NftItem({
      name: req.body['name'],
      contract: NFT_ADDR,
      collectionId: req.body['collection'],
      owner: owner,
      creator: owner,
      tokenId: 0,
      chainId: req.body['chainId'],
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
  } catch(e) {
    console.error(e);
    res.status(500).json({error: true, message: e.message});
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
  const {user, item, signature, tx} = req.body;

  const data = solidityKeccak256(['address', 'string'], [user, item]);

  if (verifyMessage(arrayify(data), signature) != verifier.address) {
    return res.status(500).json({});
  }

  const nftItem = await NftItem.findById(item).exec();

  if (nftItem) {
    if (nftItem['collectionId']) {
      await Collection.findOneAndUpdate({_id: nftItem['collectionId']}, {
        $inc: {items: 1}
      }).exec();
    }

    const txRes = await provider.getTransactionReceipt(tx);
    const mintLog = txRes.logs.find(l=>l.topics[0]==='0xe7cd4ce7f2a465edc730269a1305e8a48bad821e8fb7e152ec413829c01a53c4');
  
    const itf = new Interface([ "event Minted(address from, uint256 id, string image)" ]);
    const parsedLog = itf.parseLog(mintLog);
    const tokenId = parsedLog.args[1].toNumber();
    nftItem.tokenId = tokenId;

    nftItem.minted = true;
    await nftItem.save();
  }

  return res.json({success: true});
});

app.post('/list', upload.array(), async (req, res) => {
  const {item, signature, price} = req.body;

  const nftItem = await NftItem.findById(item).exec();
  if (!nftItem) {
    return res.status(404).send({error: true});
  }

  const signer = verifyMessage("List NFT\nItem: " + item + "\nPrice: " + price, signature);
  if ( !isEqAddr(signer, nftItem.owner) ) {
    return res.status(401).send({error: true});
  }

  try {
    nftItem.price = parseFloat(price);
  } catch(e) {
    return res.status(400).json({error: true});
  }

  nftItem.listed = true;
  await nftItem.save();

  return res.json({success: true});
});

app.post('/unlist', upload.array(), async (req, res) => {
  const {item, signature} = req.body;

  const nftItem = await NftItem.findById(item).exec();
  if (!nftItem) {
    return res.status(404).send({error: true});
  }

  const signer = verifyMessage("Cancel Listing\nItem: " + item, signature);
  if ( !isEqAddr(signer, nftItem.owner) ) {
    return res.status(401).send({error: true});
  }

  nftItem.listed = false;
  await nftItem.save();

  return res.json({success: true});
});

app.get('/buy-req', async (req, res) => {
  const {buyer, item} = req.query;

  const nft = await NftItem.findById(item).exec();

  if (!nft) {
    return res.status(404).json({error: true});
  }

  if (!nft.listed) {
    return res.status(400).json({error: true});
  }

  try {
    const signData = solidityKeccak256(['address', 'address', 'address', 'uint256', 'uint256'],
      [buyer, nft.owner, nft.contract, nft.tokenId, parseEther(nft.price.toString())]);
    const signature = await verifier.signMessage(arrayify(signData));

    res.json({
      success: true,
      signature
    })
  } catch(e) {
    console.error(e);
    res.status(500).json({error: true, message: e.message})
  }
});

app.post('/buy-confirm', upload.array(), async (req, res) => {
  const {buyer, item, signature, tx} = req.body;

  const nftItem = await NftItem.findById(item).exec();
  if (!nftItem) {
    return res.status(404).json({error: true});
  }

  try {
    const data = solidityKeccak256(['address', 'address', 'address', 'uint', 'uint'],
      [buyer, nftItem.owner, nftItem.contract, nftItem.tokenId, parseEther(nftItem.price.toString())]);

    if (verifyMessage(arrayify(data), signature) != verifier.address) {
      return res.status(400).json({});
    }

    const txRes = await provider.getTransactionReceipt(tx);
    const transferLog = txRes.logs.find(l=>l.topics[0]==='0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef');
  
    const itf = new Interface(["event Transfer(address indexed from, address indexed to, uint256 indexed id)"]);
    const parsedLog = itf.parseLog(transferLog);
    const tokenId = parsedLog.args[2].toNumber();
    const toAddr = parsedLog.args[1];

    if (tokenId !== nftItem.tokenId || !isEqAddr(buyer, toAddr)) {
      throw new Error("Verification failed");
    }

    nftItem.owner = buyer;
    nftItem.listed = false;
    nftItem.lastSold = unixTs();
    await nftItem.save();

    res.json({success: true});
  } catch(e) {
    console.error(e);
    return res.status(500).json({error: true, message: e.message})
  }
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
    contract: NFT_ADDR,
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
    sensitive: req.body['sensetive'] === 'true',
    createdAt: unixTs(),
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

app.get('/collections', async (req, res) => {
  let {category, offset, limit, sort, search} = req.query;

  offset = offset? parseInt(offset) : 0;
  limit = limit? parseInt(limit) : 120;
  sort = sort || 'createAt';

  let filter = {};
  if (category) filter.category = category;
  if (search) filter.name = {$regex: `${search}`, $options: "i"};

  try {
    const result = await Collection.find(filter).sort({
      [sort]: -1
    }).skip(offset).limit(limit).exec();

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
  // if (states.indexOf('auction') >= 0) filter.inAuction = true;

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

    if (result) {
      var collection = null;
      if (result.collectionId) {
        collection = await Collection.findById(result.collectionId);
      }
      res.json({item: result, collection, success: true});
    } else {
      return res.status(404).send({error: true});
    }
    
  } catch(e) {
    console.error(e);
    res.status(500).send({error: true});
  }
});

app.get('/user/:address', async (req, res) => {
  const {address} = req.params;

  try {
    let user = await User.findOne({
      address
    }).exec();

    if (!user) {
      user = {
        address,
        logoUrl: '',
        bannerImgUrl: '',
        name: '',
        description: '',
        socialLinks: '',
        likes: 0,
        joined: unixTs()
      }
    }

    const created = await NftItem.find({
      creator: address,
      minted: true
    }).sort({created: -1}).limit(400).exec();
    const collected = await NftItem.find({
      owner: address,
      minted: true
    }).sort({lastSold: -1}).limit(400).exec();

    return res.json({success: true, user, created, collected});
    
  } catch(e) {
    console.error(e);
    res.status(500).send({error: true, message: e.message});
  }
});

app.post('/user/:account', upload.fields([
  { name: 'logo', maxCount: 1 },
  { name: 'banner', maxCount: 1 }
]), async (req, res) => {

  const {account} = req.params;

  try {
    const logo = req.files['logo']? await renameFile(req.files['logo'][0]) : null;
    const banner = req.files['banner']? await renameFile(req.files['banner'][0]) : null;

    const address = ethers.utils.verifyMessage(`Update profile:\n\nAccount: ${account}\nTime: ${req.body['time']}`,
      req.body['signature']);

    if (!isEqAddr(address, account)) {
      return res.status(401).json({error: true, message: 'Fuck off!'});
    }

    if (parseInt(req.body['now']) + 300 < unixTs()) {
      return res.status(400).json({error: true, message: 'Too late!'});
    }

    let user = await User.findOne({
      address
    }).exec();

    if (user) {
      if (req.body['name']) user.name = req.body['name'];
      if (logo) user.logoUrl = logo;
      if (banner) user.bannerImgUrl = banner;

      await user.save();
    } else {
      user = new User({
        address,
        logoUrl: logo,
        bannerImgUrl: banner,
        name: req.body['name'] || '',
        description: '',
        socialLinks: '',
        likes: 0,
        joined: unixTs()
      });

      await user.save();
    }

    res.json({
      success: true,
      id: user._id
    });

  } catch(e) {
    console.error(e);
    res.status(500).json({error: true, message: e.message});
  }
});


app.get('/check', async (req, res) => {
    // res.send('Well done! ' + req.params.id);

  // const txRes = await provider.getTransactionReceipt('0x209dd9a2446d8a396ef82abb6b6880a373e5150a70abd17185ed1549e4676d3b');
  // const mintLog = txRes.logs.find(l=>l.topics[0]==='0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef');
  // console.log(mintLog);
  // var data = '';
  // var tokenId = 0;
  // if (mintLog) {
  //   const ift = new Interface([ "event Transfer(address indexed from, address indexed to, uint256 indexed id)" ]);
  //   data = ift.parseLog(mintLog);
  //   tokenId = data.args[2].toNumber();
  // }

  res.json({
    message: 'Working, but silence is golden!',
    data: data,
    tokenId
  });
})

const PORT = 3300;

app.listen(PORT, '0.0.0.0', () => {
  console.log(`The application is listening on port ${PORT}!`);
})