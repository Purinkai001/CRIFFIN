#!/usr/bin/env python
"""
Entry point for running the backend server.

Usage:
    python run.py
    
Or with uvicorn directly:
    uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
"""
import uvicorn
import argparse

parser = argparse.ArgumentParser(prog='PathVLMBackend')
parser.add_argument('--port', type=int, help='port to run backend', default=8000)

if __name__ == "__main__":

    args = parser.parse_args()
    uvicorn.run(
        "app.main:app",
        host="0.0.0.0",
        port=args.port,
        reload=False  # Set to True for development
    )
