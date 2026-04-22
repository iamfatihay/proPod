#!/bin/bash
# Pre-commit hook: Automatically run tests before commit
# Install: ./scripts/install-hooks.sh

echo "🔍 Running tests..."

FAILED=0

# Check backend changes
if git diff --cached --name-only | grep -q "^backend/"; then
    echo "Backend: testing..."
    cd backend
    PYTEST="./venv/bin/pytest"
    [ ! -f "$PYTEST" ] && PYTEST="pytest"
    if ! $PYTEST tests/ -x --tb=short -q 2>/dev/null; then
        echo "❌ Backend tests failed"
        FAILED=1
    else
        echo "✅ Backend tests passed"
    fi
    cd ..
fi

# Check frontend changes
if git diff --cached --name-only | grep -q "^frontend/"; then
    echo "Frontend: testing..."
    cd frontend
    if ! npm run test:ci &>/dev/null; then
        echo "❌ Frontend tests failed"
        FAILED=1
    else
        echo "✅ Frontend tests passed"
    fi
    cd ..
fi

# Exit
if [ $FAILED -eq 1 ]; then
    echo ""
    echo "❌ Commit blocked - fix tests first"
    echo "Skip with: git commit --no-verify"
    exit 1
fi

echo "✅ All tests passed"
exit 0
