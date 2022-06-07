const mongoose = require('mongoose');

const NftRecord = mongoose.Schema({
  nft: String,
  owner: String,
  id: Number,
})

module.exports = mongoose.model('NftRecord', NftRecord);
