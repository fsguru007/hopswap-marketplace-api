const { Wallet } = require("ethers");
const { solidityKeccak256, arrayify } = require("ethers/lib/utils");

const signer = new Wallet('51e40b76d52d974dba01fab5c9a58f553f4b06bd9cfe436a27c940b0c3be91e0');

const user = process.argv[2];
const tokenId = process.argv[3];

const hash = solidityKeccak256(["address", "uint256"], [user, tokenId]);

console.log(hash);

const sig = signer.signMessage(arrayify(hash));

console.log(sig);
