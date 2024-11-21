#!/bin/bash

# Get the directory where the script is located
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" &> /dev/null && pwd )"

# Setup or confirm virtual environment
ENV_DIR="$SCRIPT_DIR/gip_scraper"
if [ ! -d "$ENV_DIR" ]; then
    echo "Setting up a new Python virtual environment..."
    python3 -m venv "$ENV_DIR"
else
    echo "Using existing virtual environment."
fi

# Activate the virtual environment
source "$ENV_DIR/bin/activate"

# Install or update dependencies
echo "Installing requirements from requirements.txt..."
pip install -r "$SCRIPT_DIR/requirements.txt"

echo "Environment setup is complete."