#!/bin/bash

# Test error logging functionality

echo "========================================="
echo "Testing Error Logging"
echo "========================================="

# Check if logs directory exists
if [ -d "logs" ]; then
  echo "✓ Logs directory exists"
  
  if [ -f "logs/error-log.txt" ]; then
    echo "✓ Error log file exists"
    echo ""
    echo "Last 20 lines of error log:"
    echo "-----------------------------------------"
    tail -n 20 logs/error-log.txt
    echo "-----------------------------------------"
    echo ""
    echo "Total error entries: $(wc -l < logs/error-log.txt)"
  else
    echo "⚠ Error log file does not exist yet (will be created on first error)"
  fi
else
  echo "⚠ Logs directory does not exist yet (will be created on first error)"
fi

echo ""
echo "Error logging is configured to write to: backend/logs/error-log.txt"
echo "========================================="
