#!/usr/bin/env node

const { Command } = require('commander');
const inquirer = require('inquirer');
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const readline = require('readline');
const program = new Command();
const os = require('os');

program
  .name('ston')
  .description('A CLI tool for managing tokens')
  .version('1.0.0');

program
  .command('init')
  .description('Initialize a new token operation')
  .action(async () => {
    console.log(`
       d888888888 888888888888888   d888888888b   d8888b     88b
      888               888        888       888  888  88    888
      888               888        888       888  888   88   888
       "88888888b       888        888       888  888    88  888
              888       888        888       888  888     88 888
              888       888        888       888  888      88888
      888888888"        888         "888888888"   888       "88P
          
                    💎 Welcome to STON CLI 💎
    This tool helps you manage your token operations efficiently.\n
              `);

    const answers = await inquirer.prompt([
      {
        type: 'list',
        name: 'operation',
        message: 'Choose an operation:',
        choices: [
          'Create a new ERC721 token backed to WSTON',
          'Create a new ERC1155 token backed to WSTON',
          'Link an existing ERC721 token to WSTON',
        ],
      },
    ]);

    const cloneAndMove = (repoUrl) => {
      const tempDir = path.join(os.tmpdir(), 'temp-repo');
      try {
        if (fs.existsSync(tempDir)) {
          fs.rmdirSync(tempDir, { recursive: true });
        }
    
        execSync(`git clone ${repoUrl} ${tempDir}`, { stdio: 'inherit' });
    
        fs.readdirSync(tempDir).forEach(file => {
          const srcPath = path.join(tempDir, file);
          const destPath = path.join(process.cwd(), file);
    
          if (fs.existsSync(destPath)) {
            console.log(`Skipping existing file or directory: ${file}`);
            return;
          }
    
          fs.renameSync(srcPath, destPath);
        });
    
        fs.rmdirSync(tempDir, { recursive: true });
        console.log('Environment imported successfully.');
      } catch (error) {
        console.error('Error importing the repository:', error.message);
      }
    };
    
    switch (answers.operation) {
      case 'Create a new ERC721 token backed to WSTON':
        console.log('Creating a new ERC721 token backed to WSTON...');
        cloneAndMove('https://github.com/tokamak-network/new-ERC721-template.git');
        break;
      case 'Create a new ERC1155 token backed to WSTON':
        console.log('Creating a new ERC1155 token backed to WSTON...');
        cloneAndMove('https://github.com/tokamak-network/new-ERC1155-template.git'); 
        break;
      case 'Link an existing ERC721 token to WSTON':
        console.log('Linking an existing ERC721 token to WSTON...');
        cloneAndMove('https://github.com/tokamak-network/new-ERC721-template.git'); 
        break;
      default:
        console.log('Invalid operation');
    }
  });

  program
  .command('deploy')
  .description('Deploy the smart contract')
  .action(async () => {
    try {
      const networkConfig = {
        optimism: {
          bridgeScript: 'scripts/optimism/2.bridgeWstonToOptimism.js',
          bridgeNetwork: 'l1', // Network for the bridge script
          additionalScripts: [
            { script: 'scripts/optimism/3.deploySTON.js', network: 'l2' },
            { script: 'scripts/optimism/4.Initialization.js', network: 'l2' }
          ]
        },
        arbitrum: {
          bridgeScript: 'scripts/arbitrum/2.bridgeWstonToArbitrum.js',
          bridgeNetwork: 'l1', // Network for the bridge script
          additionalScripts: [
            { script: 'scripts/arbitrum/3.deploySTON.js', network: 'l2' },
            { script: 'scripts/arbitrum/4.Initialization.js', network: 'l2' }
          ]
        },
        zkSync: {
          bridgeScript: 'scripts/zksync/3.bridgeWstonToZkSync.js',
          bridgeNetwork: 'l1', // Network for the bridge script
          additionalScripts: [
            { script: 'scripts/zksync/4.deploySTON.js', network: 'l2' },
            { script: 'scripts/zksync/5.Initialization.js', network: 'l2' }
          ]
        },
        trh: {
          bridgeScript: 'scripts/trh/2.bridgeWstonToTrh.js',
          bridgeNetwork: 'l1', // Network for the bridge script
          additionalScripts: [
            { script: 'scripts/trh/3.deploySTON.js', network: 'l2' },
            { script: 'scripts/trh/4.Initialization.js', network: 'l2' }
          ]
        }
      };

      const { network } = await inquirer.prompt([
        {
          type: 'list',
          name: 'network',
          message: 'Select deployment network:',
          choices: Object.keys(networkConfig),
        },
      ]);

      const config = networkConfig[network];

      console.log(`
┌──────────────────────────────────────────────────────┐
│                 🚀 Deployment Checklist               │
├──────────────────────────────────────────────────────┤
│ 1. .env file configured with correct parameters       │
│ 2. L2 WSTON contract deployed on ${network.padEnd(10)}         │
│ 3. Sufficient balance in deployment account           │
└──────────────────────────────────────────────────────┘\n`);

      // Check for existing node_modules
      if (!fs.existsSync('node_modules')) {
        console.log('Installing dependencies... 📦');
        try {
          execSync('yarn install --network-timeout 600000', { 
            stdio: 'inherit',
            env: {
              ...process.env,
              NODE_ENV: 'production'
            }
          });
        } catch (error) {
          console.error('\n⚠️ Dependency installation failed. Trying with npm...');
          execSync('npm install --legacy-peer-deps', { stdio: 'inherit' });
        }
      }

      if (!fs.existsSync('artifacts')) {
        console.log('\nCompiling contracts... ⚙️');
        execSync('npx hardhat compile', { stdio: 'inherit' });
      }

      console.log(`\nInitiating ${network} deployment... 🌐`);
      execSync(`npx hardhat run ${config.script} --network ${config.network}`, { 
        stdio: 'inherit',
        env: {
          ...process.env,
          DEPLOYMENT_NETWORK: network.toUpperCase()
        }
      });

      console.log(`
┌──────────────────────────────────────────────────────────────────┐
│          ✅ Successfully deployed to ${network.padEnd(10)}       │
└──────────────────────────────────────────────────────────────────┘`);
    } catch (error) {
      console.error(`
┌──────────────────────────────────────────────────────────────────────────────┐
│          🚨 Deployment failed: ${error.message.slice(0,40).padEnd(45)}       │
└──────────────────────────────────────────────────────────────────────────────┘`);
      process.exit(1);
    }
  });

program.parse(process.argv);
