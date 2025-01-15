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
  .name('opal')
  .description('A CLI tool for managing tokens')
  .version('1.0.0');

program
  .command('init')
  .description('Initialize a new token operation')
  .action(async () => {
    console.log(`
         
       d888888888b   d8888888b      d888888b       888
      888       888 888      888   888    888      888
      888       888 888      888  888      888     888
      888       888 888888888"   88888888888888    888
      888       888 888         888          888   888
      888       888 888        888            888  888
       "888888888"  888       888              888 888888888888
          
                    💎 Welcome to Opal CLI 💎
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
        cloneAndMove('https://github.com/mehdi-defiesta/newERC721-template.git');
        break;
      case 'Create a new ERC1155 token backed to WSTON':
        console.log('Creating a new ERC1155 token backed to WSTON...');
        cloneAndMove('https://github.com/mehdi-defiesta/newERC1155-template.git'); // Correct URL
        break;
      case 'Link an existing ERC721 token to WSTON':
        console.log('Linking an existing ERC721 token to WSTON...');
        cloneAndMove('https://github.com/mehdi-defiesta/linkERC721-template.git'); // Correct URL
        break;
      default:
        console.log('Invalid operation');
    }
  });

program
  .command('deploy')
  .description('Deploy the smart contract')
  .action(() => {
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    });

    const deploy = async () => {
      try {
        console.log("\nBefore deploying, please ensure the .env file is updated with the relevant informations.");
        console.log("\nPlease ensure L2 WSTON contract is deployed on the targetted network. Otherwise please deploy it using the script provided");

        // Compile the contracts
        console.log('Compiling contracts...');
        execSync('npx hardhat compile', { stdio: 'inherit' });

        // Execute the deployment script
        console.log('Deploying contracts...');
        execSync('npx hardhat run scripts/deploy/2.deployContracts.js', { stdio: 'inherit' });
        console.log('Deployment script executed successfully.');
      } catch (error) {
        console.error('Error during deployment:', error.message);
      }
    };

    deploy();
  });

program.parse(process.argv);
