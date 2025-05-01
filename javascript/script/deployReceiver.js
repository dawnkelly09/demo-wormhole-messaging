const { ethers } = require('ethers');
const fs = require('fs');
const os = require('os');
const path = require('path');
const readline = require('readline/promises');
const { stdin: input, stdout: output } = require('process');

async function main() {
  // Load the chain configuration from the JSON file
  const chains = JSON.parse(
    fs.readFileSync(path.resolve(__dirname, '../deploy-config/chains.json'))
  );

  // Get the Celo Testnet configuration
  const celoChain = chains.chains.find((chain) => chain.description.includes('Celo Testnet'));
  if (!celoChain) {
    throw new Error('Celo Testnet configuration not found.');
  }

  // Set up the provider
  const provider = new ethers.JsonRpcProvider(celoChain.rpc);

  // Load the encrypted keystore
  const keystorePath = path.join(os.homedir(), '.foundry', 'keystores', 'CELO_AVAX');
  const keystore = fs.readFileSync(keystorePath, 'utf8');

  // Prompt the user for password
  const rl = readline.createInterface({ input, output });
  const password = await rl.question('Enter password: ');
  rl.close();

  if (!password) {
    throw new Error('No password provided.');
  }

  // Decrypt and connect the wallet
  const wallet = await ethers.Wallet.fromEncryptedJson(keystore, password);
  const connectedWallet = wallet.connect(provider);

  // Load the ABI and bytecode of the MessageReceiver contract
  const messageReceiverJson = JSON.parse(
    fs.readFileSync(
      path.resolve(__dirname, '../out/MessageReceiver.sol/MessageReceiver.json'),
      'utf8'
    )
  );

  const abi = messageReceiverJson.abi;
  const bytecode = messageReceiverJson.bytecode;

  // Create a ContractFactory for MessageReceiver
  const MessageReceiver = new ethers.ContractFactory(abi, bytecode, connectedWallet);

  // Deploy the contract
  const receiverContract = await MessageReceiver.deploy(celoChain.wormholeRelayer);
  await receiverContract.waitForDeployment();

  console.log('MessageReceiver deployed to:', receiverContract.target);

  // Update the deployedContracts.json file
  const deployedContractsPath = path.resolve(__dirname, '../deploy-config/deployedContracts.json');
  const deployedContracts = JSON.parse(fs.readFileSync(deployedContractsPath, 'utf8'));

  const avalancheSenderAddress = deployedContracts.avalanche?.MessageSender;
  if (!avalancheSenderAddress) {
    throw new Error('Avalanche MessageSender address not found.');
  }

  const sourceChainId = 6;

  const tx = await receiverContract.setRegisteredSender(
    sourceChainId,
    ethers.zeroPadValue(avalancheSenderAddress, 32)
  );
  await tx.wait();

  console.log(
    `Registered MessageSender (${avalancheSenderAddress}) for Avalanche chain (${sourceChainId})`
  );

  deployedContracts.celo = {
    MessageReceiver: receiverContract.target,
    deployedAt: new Date().toISOString(),
  };

  fs.writeFileSync(deployedContractsPath, JSON.stringify(deployedContracts, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});