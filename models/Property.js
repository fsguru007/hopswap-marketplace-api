var mongoose = require('mongoose');

var Property = new mongoose.Schema({
  collectionId: String,
  nftId: String,
  key: String,
  value: String
});

module.exports = mongoose.model('properties', Property);