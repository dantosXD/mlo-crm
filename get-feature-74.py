#!/usr/bin/env python3
import sys
from pathlib import Path

# Add autocoder-master to path
sys.path.insert(0, str(Path(__file__).parent / "autocoder-master"))

from api.database import create_database, Feature
import os

PROJECT_DIR = Path(os.environ.get("PROJECT_DIR", ".")).resolve()
engine, session_maker = create_database(PROJECT_DIR)

session = session_maker()
try:
    feature = session.query(Feature).filter(Feature.id == 74).first()
    if feature:
        print(feature.to_json(indent=2))
    else:
        print(f"Feature #74 not found")
finally:
    session.close()
