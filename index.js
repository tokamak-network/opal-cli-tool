#!/usr/bin/env node

const { Command } = require('commander');
const inquirer = require('inquirer');
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
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
          'Create a new GemSTON web3 game backed by WSTON',
          'Create a new ERC721 token backed to WSTON',
          'Create a new ERC404 token backed to WSTON',
          'Link an existing ERC721 token to WSTON',
        ],
      },
    ]);

    const cloneAndMove = (repoUrl) => {
      const tempDir = path.join(os.tmpdir(), 'temp-repo');
      try {
        // Check if the temporary directory exists and remove it
        if (fs.existsSync(tempDir)) {
          fs.rmdirSync(tempDir, { recursive: true });
        }
    
        // Clone the repository into a temporary directory
        execSync(`git clone ${repoUrl} ${tempDir}`, { stdio: 'inherit' });
    
        // Move contents from the temporary directory to the current directory
        fs.readdirSync(tempDir).forEach(file => {
          const srcPath = path.join(tempDir, file);
          const destPath = path.join(process.cwd(), file);
    
          // Check if the destination path already exists
          if (fs.existsSync(destPath)) {
            console.log(`Skipping existing file or directory: ${file}`);
            return;
          }
    
          fs.renameSync(srcPath, destPath);
        });
    
        // Remove the temporary directory
        fs.rmdirSync(tempDir, { recursive: true });
        console.log('Environment imported successfully.');
      } catch (error) {
        console.error('Error importing the repository:', error.message);
      }
    };
    

    switch (answers.operation) {
      case 'Create a new GemSTON web3 game backed by WSTON':
        console.log('Creating a new gemSTON environment...');
        cloneAndMove('https://github.com/mehdi-defiesta/gem-nft-contract-template.git');
        break;
      case 'Create a new ERC721 token backed to WSTON':
        console.log('Creating a new ERC721 token backed to WSTON...');
        cloneAndMove('https://github.com/mehdi-defiesta/newERC721-template.git');
        break;
      case 'Create a new ERC404 token backed to WSTON':
        console.log('Creating a new ERC404 token backed to WSTON...');
        cloneAndMove('https://github.com/mehdi-defiesta/newERC721-template.git');
        break;
      case 'Link an existing ERC721 token to WSTON':
        console.log('Linking an existing ERC721 token to WSTON...');
        cloneAndMove('https://github.com/mehdi-defiesta/newERC721-template.git');
        break;
      default:
        console.log('Invalid operation');
    }
  });

program.parse(process.argv);
