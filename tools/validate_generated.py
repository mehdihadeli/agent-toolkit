#!/usr/bin/env python3
"""Check generated native artifacts against canonical sources without writing."""

import sys

from generate import main


if __name__ == "__main__":
    raise SystemExit(main([*sys.argv[1:], "--check"]))