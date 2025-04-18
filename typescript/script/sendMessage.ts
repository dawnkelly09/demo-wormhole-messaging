import { ethers } from 'ethers';
import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';
import { ChainsConfig, DeployedContracts } from './interfaces';

dotenv.config();

async function main(): Promise<void> {
	// Load the chain configuration and deployed contract addresses
	const chains: ChainsConfig = JSON.parse(
		fs.readFileSync(path.resolve(__dirname, '../deploy-config/chains.json'), 'utf8')
	);

	const deployedContracts: DeployedContracts = JSON.parse(
		fs.readFileSync(path.resolve(__dirname, '../deploy-config/deployedContracts.json'), 'utf8')
	);

	console.log('Sender Contract Address: ', deployedContracts.ethSepolia.MessageSender);
	console.log('Receiver Contract Address: ', deployedContracts.baseSepolia.MessageReceiver);
	console.log('...');

	// Get the Eth Sepolia configuration
	const ethSepoliaChain = chains.chains.find((chain) =>
		chain.description.includes('Ethereuem Sepolia TestNet')
	);

	if (!ethSepoliaChain) {
		throw new Error('ETH Sepolia TestNet configuration not found in chains.json.');
	}

	// Set up the provider and wallet
	const provider = new ethers.JsonRpcProvider(ethSepoliaChain.rpc);
	const wallet = new ethers.Wallet(process.env.PRIVATE_KEY || '', provider);

	// Load the ABI of the MessageSender contract
	const messageSenderJson = JSON.parse(
		fs.readFileSync(path.resolve(__dirname, '../out/MessageSender.sol/MessageSender.json'), 'utf8')
	);

	const abi = messageSenderJson.abi;

	// Create a contract instance for MessageSender
	const MessageSender = new ethers.Contract(
		deployedContracts.ethSepolia.MessageSender, // Automatically use the deployed address
		abi,
		wallet
	);

	// Define the target chain and target address (the Base Sepollia receiver contract)
	const targetChain = 10004; // Wormhole chain ID for Base Sepolia
	const targetAddress = deployedContracts.baseSepolia.MessageReceiver; // Automatically use the deployed address

	// The message you want to send
	const message = 'Hello from Eth Sepolia to Base Sepolia!';

	// Dynamically quote the cross-chain cost
	const txCost = await MessageSender.quoteCrossChainCost(targetChain);

	// Send the message (make sure to send enough gas in the transaction)
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
