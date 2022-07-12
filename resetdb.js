const mongoose = require('mongoose');

const NftItem = require('./models/NftItem');
const Collection = require('./models/Collection');
const Property = require('./models/Property');


async function reset() {

  await NftItem.deleteMany({});
  await Collection.deleteMany({});
  await Property.deleteMany({});

  console.log('--- finished ---');

  return mongoose.disconnect();
}

mongoose.connect('mongodb://127.0.0.1:27017').then(reset);
