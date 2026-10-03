"""Vercel Python function: preserve incoming Host, path, query and HTTP method."""
import pathlib
import sys
sys.path.insert(0,str(pathlib.Path(__file__).resolve().parents[1]))
from server import Handler

class handler(Handler):
    pass
