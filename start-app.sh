#!/bin/bash
# Export path for Node and NVM
export PATH=$HOME/.nvm/versions/node/v24.11.1/bin:$PATH

# Navigate to application directory
cd "$(dirname "$0")"

# Start the application
npm start
