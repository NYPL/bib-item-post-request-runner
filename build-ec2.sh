#!/bin/bash

# This script documents how to set up a freshly minted EC2
# Assumes an EC2 t2.micro running Amazon Linux

echo ⛵️  Updating Yum
sudo yum update -y

echo ⛵  Installing Node 8
curl --silent --location https://rpm.nodesource.com/setup_8.x | sudo bash -
sudo yum install -y nodejs

echo ⛵️  Installing Git and NPM
sudo yum install git npm

echo ⛵️  Cloning Bib/Item Post Request Runner
git clone https://github.com/NYPL/bib-item-post-request-runner.git

echo ⛵️  Installing Node packages
cd bib-item-post-request-runner
npm i
