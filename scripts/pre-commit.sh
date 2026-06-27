#!/bin/bash
# Pre-commit hook: fast syntax check only.
# Full test suite runs in CI (GitHub Actions) on pull requests.

FAILED=0

# Backend: syntax-check changed Python files
CHANGED_PY=$(git diff --cached --name-only | grep "^backend/.*\.py$")
if [ -n "$CHANGED_PY" ]; then
    PYTHON_BIN="backend/venv/bin/python"
    [ ! -x "$PYTHON_BIN" ] && PYTHON_BIN="python3"
    echo "Checking Python syntax..."
    while IFS= read -r file; do
        if ! "$PYTHON_BIN" -m py_compile "$file" 2>/dev/null; then
            echo "  ❌ $file"
            FAILED=1
        fi
    done <<< "$CHANGED_PY"
    [ $FAILED -eq 0 ] && echo "  ✅ Python OK"
fi

# Frontend: syntax-check changed JS/JSX files
CHANGED_JS=$(git diff --cached --name-only | grep "^frontend/.*\.\(js\|jsx\)$")
if [ -n "$CHANGED_JS" ]; then
    echo "Checking JS syntax..."
    while IFS= read -r file; do
        if ! node --check "$file" 2>/dev/null; then
            echo "  ❌ $file"
            FAILED=1
        fi
    done <<< "$CHANGED_JS"
    [ $FAILED -eq 0 ] && echo "  ✅ JS OK"
fi

if [ $FAILED -eq 1 ]; then
    echo ""
    echo "Fix syntax errors before committing. Full tests run in CI on PR."
    exit 1
fi

exit 0
