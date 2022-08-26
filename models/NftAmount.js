var mongoose = require('mongoose');

var NftAmount = new mongoose.Schema({
  item: String,
  account: String,
  amount: Number,
});

module.exports = mongoose.model('nft_amounts', NftAmount);