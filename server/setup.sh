#!/bin/bash

# Setup script for the Read Me server

cd "$(dirname "$0")"

# Create venv if it doesn't exist
if [ ! -d ".venv" ]; then
    echo "Creating virtual environment with Python 3.11..."
    python3.11 -m venv .venv
fi

# Activate venv
source .venv/bin/activate

# Install dependencies
echo "Installing dependencies..."
pip install -r requirements.txt

echo ""
echo "Setup complete! To start the server:"
echo "  source .venv/bin/activate"
echo "  python main.py"
