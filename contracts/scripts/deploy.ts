import { ethers } from "hardhat";
import { Contract } from "ethers";
import fs from "fs";
import path from "path";

interface DeploymentAddresses {
  PrivateInsightCore: string;
  ZKProofVerifier: string;
  DataVault: string;
  AlithAgent: string;
  deploymentTimestamp: number;
  deployer: string;
  network: string;
}

async function main() {
  console.log("🚀 Starting PrivateInsight Platform Deployment...\n");

  const [deployer] = await ethers.getSigners();
  const network = await ethers.provider.getNetwork();
  
  console.log("📋 Deployment Details:");
  console.log(`• Network: ${network.name} (Chain ID: ${network.chainId})`);
  console.log(`• Deployer: ${deployer.address}`);
  console.log(`• Balance: ${ethers.formatEther(await ethers.provider.getBalance(deployer.address))} ETH\n`);

  // Deploy contracts in order of dependencies
  const deploymentAddresses: DeploymentAddresses = {
    PrivateInsightCore: "",
    ZKProofVerifier: "",
    DataVault: "",
    AlithAgent: "",
    deploymentTimestamp: Date.now(),
    deployer: deployer.address,
    network: network.name
  };

  try {
    // 1. Deploy ZK Proof Verifier
    console.log("🔐 Deploying ZK Proof Verifier...");
    const ZKProofVerifier = await ethers.getContractFactory("ZKProofVerifier");
    const zkVerifier = await ZKProofVerifier.deploy();
    await zkVerifier.waitForDeployment();
    await zkVerifier.initialize(deployer.address);
    deploymentAddresses.ZKProofVerifier = await zkVerifier.getAddress();
    console.log(`✅ ZK Proof Verifier deployed to: ${deploymentAddresses.ZKProofVerifier}\n`);

    // 2. Deploy Data Vault
    console.log("🗄️ Deploying Data Vault...");
    const DataVault = await ethers.getContractFactory("DataVault");
    const dataVault = await DataVault.deploy();
    await dataVault.waitForDeployment();
    await dataVault.initialize(deployer.address);
    deploymentAddresses.DataVault = await dataVault.getAddress();
    console.log(`✅ Data Vault deployed to: ${deploymentAddresses.DataVault}\n`);

    // 3. Deploy Alith Agent
    console.log("🤖 Deploying Alith Agent...");
    const AlithAgent = await ethers.getContractFactory("AlithAgent");
    const alithAgent = await AlithAgent.deploy();
    await alithAgent.waitForDeployment();
    await alithAgent.initialize(
      deployer.address,
      deployer.address, // Temporary oracle address
      "https://api.alith.ai/v1" // Default API endpoint
    );
    deploymentAddresses.AlithAgent = await alithAgent.getAddress();
    console.log(`✅ Alith Agent deployed to: ${deploymentAddresses.AlithAgent}\n`);

    // 4. Deploy PrivateInsight Core
    console.log("🏗️ Deploying PrivateInsight Core...");
    const PrivateInsightCore = await ethers.getContractFactory("PrivateInsightCore");
    const privateInsightCore = await PrivateInsightCore.deploy();
    await privateInsightCore.waitForDeployment();
    await privateInsightCore.initialize(
      deployer.address,
      deploymentAddresses.ZKProofVerifier,
      deploymentAddresses.DataVault,
      deploymentAddresses.AlithAgent
    );
    deploymentAddresses.PrivateInsightCore = await privateInsightCore.getAddress();
    console.log(`✅ PrivateInsight Core deployed to: ${deploymentAddresses.PrivateInsightCore}\n`);

    // Setup initial configurations
    console.log("⚙️ Setting up initial configurations...\n");

    // Grant roles to PrivateInsight Core
    console.log("🔑 Granting necessary roles...");
    
    // Grant VERIFIER_ROLE to PrivateInsight Core in ZKProofVerifier
    const VERIFIER_ROLE = ethers.keccak256(ethers.toUtf8Bytes("VERIFIER_ROLE"));
    await zkVerifier.grantRole(VERIFIER_ROLE, deploymentAddresses.PrivateInsightCore);
    console.log("• Granted VERIFIER_ROLE to PrivateInsight Core");

    // Grant ANALYTICS_ROLE and VERIFIER_ROLE to deployer in PrivateInsight Core
    const ANALYTICS_ROLE = ethers.keccak256(ethers.toUtf8Bytes("ANALYTICS_ROLE"));
    await privateInsightCore.grantRole(ANALYTICS_ROLE, deployer.address);
    await privateInsightCore.grantRole(VERIFIER_ROLE, deployer.address);
    console.log("• Granted ANALYTICS_ROLE and VERIFIER_ROLE to deployer");

    // Grant INFERENCE_ROLE to PrivateInsight Core in Alith Agent
    const INFERENCE_ROLE = ethers.keccak256(ethers.toUtf8Bytes("INFERENCE_ROLE"));
    await alithAgent.grantRole(INFERENCE_ROLE, deploymentAddresses.PrivateInsightCore);
    console.log("• Granted INFERENCE_ROLE to PrivateInsight Core\n");

    // Register a default analytics circuit
    console.log("🔧 Registering default analytics circuit...");
    const defaultCircuitHash = ethers.keccak256(ethers.toUtf8Bytes("DEFAULT_PRIVACY_ANALYTICS_CIRCUIT_V1"));
    const dummyVerifyingKey = ethers.randomBytes(256);
    await zkVerifier.registerVerificationKey(defaultCircuitHash, dummyVerifyingKey);
    console.log("• Registered default analytics circuit\n");

    // Register a default AI model
    console.log("🧠 Registering default AI model...");
    const defaultModelHash = ethers.keccak256(ethers.toUtf8Bytes("PRIVATE_ANALYTICS_MODEL_V1"));
    await alithAgent.registerAIModel(
      "Private Analytics Model",
      "1.0.0",
      defaultModelHash,
      ethers.parseEther("0.001") // 0.001 ETH per inference
    );
    console.log("• Registered default AI model\n");

    // Setup initial privacy budget for demo dataset
    console.log("📊 Setting up demo privacy budget...");
    const demoDatasetHash = ethers.keccak256(ethers.toUtf8Bytes("DEMO_DATASET_V1"));
    await privateInsightCore.allocatePrivacyBudget(
      demoDatasetHash,
      ethers.parseEther("10") // 10 epsilon units
    );
    console.log("• Allocated privacy budget for demo dataset\n");

    // Save deployment addresses
    const deploymentsDir = path.join(__dirname, "../deployments");
    if (!fs.existsSync(deploymentsDir)) {
      fs.mkdirSync(deploymentsDir, { recursive: true });
    }

    const deploymentFile = path.join(deploymentsDir, `${network.name}_${network.chainId}.json`);
    fs.writeFileSync(deploymentFile, JSON.stringify(deploymentAddresses, null, 2));

    // Generate environment variables
    const envVars = `
# PrivateInsight Contract Addresses - ${network.name}
PRIVATE_INSIGHT_CORE_ADDRESS=${deploymentAddresses.PrivateInsightCore}
ZK_ANALYTICS_ADDRESS=${deploymentAddresses.ZKProofVerifier}
MPC_COORDINATOR_ADDRESS=${deploymentAddresses.DataVault}
DATA_VAULT_ADDRESS=${deploymentAddresses.DataVault}
AI_MODEL_REGISTRY_ADDRESS=${deploymentAddresses.AlithAgent}

# Contract Deployment Info
DEPLOYMENT_TIMESTAMP=${deploymentAddresses.deploymentTimestamp}
DEPLOYER_ADDRESS=${deploymentAddresses.deployer}
NETWORK_NAME=${deploymentAddresses.network}
CHAIN_ID=${network.chainId}
    `.trim();

    const envFile = path.join(deploymentsDir, `${network.name}_${network.chainId}.env`);
    fs.writeFileSync(envFile, envVars);

    // Display deployment summary
    console.log("🎉 Deployment Complete!\n");
    console.log("📋 Contract Addresses:");
    console.log(`• PrivateInsight Core: ${deploymentAddresses.PrivateInsightCore}`);
    console.log(`• ZK Proof Verifier:   ${deploymentAddresses.ZKProofVerifier}`);
    console.log(`• Data Vault:          ${deploymentAddresses.DataVault}`);
    console.log(`• Alith Agent:         ${deploymentAddresses.AlithAgent}\n`);

    console.log("📁 Files Created:");
    console.log(`• Deployment addresses: ${deploymentFile}`);
    console.log(`• Environment variables: ${envFile}\n`);

    console.log("🚀 Platform is ready for use!");
    console.log("• Roles have been configured");
    console.log("• Default circuits and models are registered");
    console.log("• Demo privacy budget is allocated\n");

    // Verify contracts on block explorer (if not local network)
    if (network.chainId !== 31337n && network.chainId !== 1337n) {
      console.log("🔍 To verify contracts on block explorer, run:");
      console.log(`• npx hardhat verify --network ${network.name} ${deploymentAddresses.ZKProofVerifier}`);
      console.log(`• npx hardhat verify --network ${network.name} ${deploymentAddresses.DataVault}`);
      console.log(`• npx hardhat verify --network ${network.name} ${deploymentAddresses.AlithAgent}`);
      console.log(`• npx hardhat verify --network ${network.name} ${deploymentAddresses.PrivateInsightCore}\n`);
    }

    return deploymentAddresses;

  } catch (error) {
    console.error("❌ Deployment failed:", error);
    process.exit(1);
  }
}

// Execute deployment
if (require.main === module) {
  main()
    .then(() => process.exit(0))
    .catch((error) => {
      console.error(error);
      process.exit(1);
    });
}

export default main; 