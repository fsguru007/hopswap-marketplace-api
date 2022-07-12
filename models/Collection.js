var mongoose = require('mongoose');

var Collection = new mongoose.Schema({
  contract: String,
  creator: String,
  owner: String,
  logoUrl: String,
  bannerImgUrl: String,
  featuredImgUrl: String,
  name: String,
  description: String,
  socialLinks: String,
  creatorFee: Number,
  category: String,
  sensetive: Boolean,
  items: Number,
});

module.exports = mongoose.model('collections', Collection);