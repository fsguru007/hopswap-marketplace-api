var mongoose = require('mongoose');

var User = new mongoose.Schema({
  address: String,
  logoUrl: String,
  bannerImgUrl: String,
  name: String,
  description: String,
  socialLinks: String,
  likes: Number,
  joined: Number
});

module.exports = mongoose.model('users', User);