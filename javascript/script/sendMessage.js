const { ethers } = require('ethers');
const fs = require('fs');
const os = require('os');
const path = require('path');
const readline = require('readline/promises');
const { stdin: input, stdout: output } = require('process');

async function main() {
  // Load the chain configuration and deployed contract addresses
  const chains = JSON.parse(
    fs.readFileSync(path.resolve(__dirname, '../deploy-config/chains.json'))
  );
  const deployedContracts = JSON.parse(
    fs.readFileSync(path.resolve(__dirname, '../deploy-config/deployedContracts.json'))
  );

  console.log('Sender Contract Address: ', deployedContracts.avalanche.MessageSender);
  console.log('Receiver Contract Address: ', deployedContracts.celo.MessageReceiver);
  console.log('...');

  // Get the Avalanche Fuji configuration
  const avalancheChain = chains.chains.find((chain) =>
    chain.description.includes('Avalanche testnet')
  );
  if (!avalancheChain) {
    throw new Error('Avalanche testnet configuration not found.');
  }

  // Set up the provider
  const provider = new ethers.JsonRpcProvider(avalancheChain.rpc);

  // Load the encrypted keystore
  const keystorePath = path.join(os.homedir(), '.foundry', 'keystores', 'CELO_AVAX');
  const keystore = fs.readFileSync(keystorePath, 'utf8');

  // Prompt the user for the keystore password
  const rl = readline.createInterface({ input, output });
  const password = await rl.question('Enter password: ');
  rl.close();

  if (!password) {
    throw new Error('No password provided.');
  }

  // Decrypt and connect the wallet
  const wallet = await ethers.Wallet.fromEncryptedJson(keystore, password);
  const connectedWallet = wallet.connect(provider);

  // Load the ABI of the MessageSender contract
  const messageSenderJson = JSON.parse(
    fs.readFileSync(path.resolve(__dirname, '../out/MessageSender.sol/MessageSender.json'), 'utf8')
  );
  const abi = messageSenderJson.abi;

  // Create a contract instance for MessageSender
  const MessageSender = new ethers.Contract(
    deployedContracts.avalanche.MessageSender,
    abi,
    connectedWallet
  );

  // Define the target chain and target address (the Celo receiver contract)
  const targetChain = 14; // Wormhole chain ID for Celo Alfajores
  const targetAddress = deployedContracts.celo.MessageReceiver;

  // The message you want to send
  const message = 'Hello from Avalanche to Celo!';

  // Dynamically quote the cross-chain cost
  const txCost = await MessageSender.quoteCrossChainCost(targetChain);

  // Send the message
  const tx = await MessageSender.sendMessage(targetChain, targetAddress, message, {
    value: txCost,
  });

  console.log('Transaction sent, waiting for confirmation...');
  await tx.wait();
  console.log('...');

  console.log('Message sent! Transaction hash:', tx.hash);
  console.log(
    `You may see the transaction status on the Wormhole Explorer: https://wormholescan.io/#/tx/${tx.hash}?network=TESTNET`
  );
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});