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
  price: String,
  minted: Boolean
});

module.exports = mongoose.model('nft_items', NftItem);