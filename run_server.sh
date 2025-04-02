#!/bin/bash
# Script to start the WhisperSubtitler application with optimal settings for concurrent users

# Determine the number of CPU cores for optimal worker configuration
CORES=$(nproc)

# If there are at least 2 cores, use (cores - 1) workers, otherwise use 1
if [ $CORES -gt 1 ]; then
    WORKERS=$((CORES - 1))
else
    WORKERS=1
fi

# Use 2 threads per worker for better I/O handling during file processing
THREADS=2

# Use a 2-minute timeout to allow for processing of larger files
TIMEOUT=120

echo "Starting WhisperSubtitler with $WORKERS workers × $THREADS threads per worker"
echo "Server will be available at http://0.0.0.0:5000"

# Run the application with the calculated optimal settings
python3 run.py --workers=$WORKERS --threads=$THREADS --timeout=$TIMEOUT --port=5000