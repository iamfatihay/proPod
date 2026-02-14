#!/bin/bash
# Quick setup: Install pre-commit hook for automatic testing

cp scripts/pre-commit.sh .git/hooks/pre-commit
chmod +x .git/hooks/pre-commit

echo "✅ Pre-commit hook installed"
echo ""
echo "Tests will now run automatically before each commit."
echo "Skip with: git commit --no-verify"
