#!/usr/bin/env node

const { Command } = require('commander');
const inquirer = require('inquirer');
const { execSync } = require('child_process');
const path = require('path');
const program = new Command();

program
  .name('opal')
  .description('A CLI tool for managing tokens')
  .version('1.0.0');

program
  .command('init')
  .description('Initialize a new token operation')
  .action(async () => {
    // Print the ASCII art and welcome message
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

    // Prompt the user to choose an operation
    const answers = await inquirer.prompt([
      {
        type: 'list',
        name: 'operation',
        message: 'Choose an operation:',
        choices: [
          'Create a new ERC721 token linked to WSTON',
          'Create a new ERC1155 token linked to WSTON',
          'Create a new ERC404 token linked to WSTON',
          'Link an existing ERC721 token to WSTON',
        ],
      },
    ]);

    // Handle the user's choice
    switch (answers.operation) {
      case 'Create a new ERC721 token linked to WSTON':
        console.log('Creating a new ERC721 token linked to WSTON...');
        try {
          const repoUrl = 'https://github.com/tokamak-network/gem-nft-contract'; 
          execSync(`git clone ${repoUrl}`, { stdio: 'inherit' });
          console.log('Environment imported successfully.');
        } catch (error) {
          console.error('Error cloning the repository:', error.message);
        }
        break;
      case 'Create a new ERC1155 token linked to WSTON':
        console.log('Creating a new ERC1155 token linked to WSTON...');
        try {
            const repoUrl = 'https://github.com/tokamak-network/gem-nft-contract'; 
            execSync(`git clone ${repoUrl}`, { stdio: 'inherit' });
            console.log('Environment imported successfully.');
          } catch (error) {
            console.error('Error cloning the repository:', error.message);
          }
        break;
      case 'Create a new ERC404 token linked to WSTON':
        console.log('Creating a new ERC404 token linked to WSTON...');
        try {
            const repoUrl = 'https://github.com/tokamak-network/gem-nft-contract'; 
            execSync(`git clone ${repoUrl}`, { stdio: 'inherit' });
            console.log('Environment imported successfully.');
          } catch (error) {
            console.error('Error cloning the repository:', error.message);
          }
        break;
      case 'Link an existing ERC721 token to WSTON':
        console.log('Linking an existing ERC721 token to WSTON...');
        try {
            const repoUrl = 'https://github.com/tokamak-network/gem-nft-contract'; 
            execSync(`git clone ${repoUrl}`, { stdio: 'inherit' });
            console.log('Environment imported successfully.');
          } catch (error) {
            console.error('Error cloning the repository:', error.message);
          }
        break;
      default:
        console.log('Invalid operation');
    }
  });

program.parse(process.argv);
