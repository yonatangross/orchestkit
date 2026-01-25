#!/usr/bin/env python3
"""Setup script for mem0-skill-lib package.

Install with: pip install -e skills/mem0-memory/scripts/

This makes the lib module importable without sys.path manipulation,
allowing scripts to use: from lib.mem0_client import get_mem0_client
"""
from setuptools import setup

setup(
    name="mem0-skill-lib",
    version="1.0.0",
    description="Shared mem0 client library for OrchestKit mem0-memory scripts",
    packages=["lib"],
    package_dir={"": "."},
    install_requires=[
        "mem0ai>=1.0.0",
        "python-dotenv>=1.0.0",
    ],
    python_requires=">=3.11",
)
