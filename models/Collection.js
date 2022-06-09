var mongoose = require('mongoose');

var Collection = new mongoose.Schema({
  contract: String,
  owner: String,
  imageUrl: String,
  bannerImgUrl: String,
  name: String,
  description: String,
  link: String,
});

module.exports = mongoose.model('collections', Collection);