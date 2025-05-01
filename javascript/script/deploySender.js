const { ethers } = require("ethers");
const fs = require("fs");
const os = require("os");
const path = require("path");
const readline = require("readline/promises");
const { stdin: input, stdout: output } = require("process");

async function main() {
  // Load the chain configuration from JSON
  const chains = JSON.parse(
    fs.readFileSync(path.resolve(__dirname, "../deploy-config/chains.json"))
  );

  // Get the Avalanche Fuji configuration
  const avalancheChain = chains.chains.find((chain) =>
    chain.description.includes("Avalanche testnet")
  );
  if (!avalancheChain) {
    throw new Error("Avalanche testnet configuration not found.");
  }

  // Set up the provider
  const provider = new ethers.JsonRpcProvider(avalancheChain.rpc);

  // Load the encrypted keystore
  const keystorePath = path.join(os.homedir(), ".foundry", "keystores", "CELO_AVAX");
  const keystore = fs.readFileSync(keystorePath, "utf8");

  // Prompt the user for password
  const rl = readline.createInterface({ input, output });
  const password = await rl.question("Enter password: ");
  rl.close();

  if (!password) {
    throw new Error("No password provided.");
  }

  // Decrypt and connect the wallet
  const wallet = await ethers.Wallet.fromEncryptedJson(keystore, password);
  const connectedWallet = wallet.connect(provider);

  // Load the ABI and bytecode of the MessageSender contract
  const messageSenderJson = JSON.parse(
    fs.readFileSync(path.resolve(__dirname, "../out/MessageSender.sol/MessageSender.json"), "utf8")
  );

  const abi = messageSenderJson.abi;
  const bytecode = messageSenderJson.bytecode;

  // Create a ContractFactory for MessageSender
  const MessageSender = new ethers.ContractFactory(abi, bytecode, connectedWallet);

  // Deploy the contract using the Wormhole Relayer address for Avalanche Fuji
  const senderContract = await MessageSender.deploy(avalancheChain.wormholeRelayer);
  await senderContract.waitForDeployment();

  console.log("MessageSender deployed to:", senderContract.target);

  // Update the deployedContracts.json file
  const deployedContractsPath = path.resolve(__dirname, "../deploy-config/deployedContracts.json");
  const deployedContracts = JSON.parse(fs.readFileSync(deployedContractsPath, "utf8"));

  deployedContracts.avalanche = {
    MessageSender: senderContract.target,
    deployedAt: new Date().toISOString()
  };

  fs.writeFileSync(deployedContractsPath, JSON.stringify(deployedContracts, null, 2));
}

main().catch(error => {
  console.error(error);
  process.exit(1);
});