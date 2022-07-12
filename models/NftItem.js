var mongoose = require('mongoose');

var NftItem = new mongoose.Schema({
  contract: String,
  collectionId: String,
  tokenId: String,
  owner: String,
  imageUrl: String,
  name: String,
  description: String,
  link: String,
  listed: Boolean,
  price: Number,
  minted: Boolean,
  sensitive: Boolean,
  lastSold: Number,
  created: Number,
  likes: Number,
  inAuction: Boolean,
  auctionEnd: Number,
});

module.exports = mongoose.model('nft_items', NftItem);