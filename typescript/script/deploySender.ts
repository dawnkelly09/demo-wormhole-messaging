import { ethers } from 'ethers';
import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';
import { ChainsConfig, DeployedContracts, MessageSenderJson } from './interfaces';

dotenv.config();

async function main(): Promise<void> {
	// Load the chain configuration from JSON
	const chains: ChainsConfig = JSON.parse(
		fs.readFileSync(path.resolve(__dirname, '../deploy-config/chains.json'), 'utf8')
	);

	// Get the ETH Sepolia configuration
	const ethSepoliaChain = chains.chains.find((chain) =>
		chain.description.includes('Ethereuem Sepolia TestNet')
	);
	if (!ethSepoliaChain) {
		throw new Error('Ethereum Sepolia TestNet configuration not found in chains.json.');
	}

	// Set up the provider and wallet
	const provider = new ethers.JsonRpcProvider(ethSepoliaChain.rpc);
	const wallet = new ethers.Wallet(process.env.PRIVATE_KEY || '', provider);

	// Load the ABI and bytecode of the MessageSender contract
	const messageSenderJson: MessageSenderJson = JSON.parse(
		fs.readFileSync(path.resolve(__dirname, '../out/MessageSender.sol/MessageSender.json'), 'utf8')
	);

	const { abi, bytecode } = messageSenderJson;

	// Create a ContractFactory for MessageSender
	const MessageSender = new ethers.ContractFactory(abi, bytecode, wallet);

	// Deploy the contract using the Wormhole Relayer address for Eth Sepolia
	const senderContract = await MessageSender.deploy(ethSepoliaChain.wormholeRelayer);
	await senderContract.waitForDeployment();

	console.log('MessageSender deployed to:', senderContract.target); // `target` is the address in ethers.js v6

	// Update the deployedContracts.json file
	const deployedContractsPath = path.resolve(__dirname, '../deploy-config/deployedContracts.json');
	const deployedContracts: DeployedContracts = JSON.parse(
		fs.readFileSync(deployedContractsPath, 'utf8')
	);

	deployedContracts.ethSepolia = {
		MessageSender: senderContract.target as any,
		deployedAt: new Date().toISOString(),
	};

	fs.writeFileSync(deployedContractsPath, JSON.stringify(deployedContracts, null, 2));
}

main().catch((error) => {
	console.error(error);
	process.exit(1);
});
