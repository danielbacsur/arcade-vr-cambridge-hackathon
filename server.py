#!/usr/bin/env python3
"""Local-only integration harness. No Arcade authentication or reverse proxy."""
import collections
import json
import pathlib
import secrets
import threading
import time
import urllib.request
import urllib.error
from http.server import ThreadingHTTPServer, SimpleHTTPRequestHandler
from urllib.parse import urlparse, parse_qs

ROOT = pathlib.Path(__file__).resolve().parent
CONFIG_FILE = ROOT / 'extension' / 'config.json'
if CONFIG_FILE.exists():
    TOKEN = json.loads(CONFIG_FILE.read_text())['token']
else:
    TOKEN = secrets.token_urlsafe(32)
    CONFIG_FILE.write_text(json.dumps({'relay':'http://localhost:8765','token':TOKEN},indent=2))
EVENTS = collections.deque(maxlen=2000)
COMMANDS = {}
LOCK = threading.Lock()
SEQUENCE = 0
OPS = {'ping','describe','xr.check','scene.snapshot','camera.pose','camera.restore'}

class Handler(SimpleHTTPRequestHandler):
    def __init__(self,*args,**kwargs):
        super().__init__(*args,directory=str(ROOT/'web'),**kwargs)

    def json_response(self,data,status=200):
        body=json.dumps(data).encode()
        self.send_response(status)
        self.send_header('Content-Type','application/json')
        self.send_header('Cache-Control','no-store')
        self.send_header('Content-Length',str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def authorized(self):
        return secrets.compare_digest(self.headers.get('X-Lab-Token',''),TOKEN)

    def do_GET(self):
        parsed=urlparse(self.path)
        if parsed.path=='/proxy-adapter.js':
            body=(ROOT/'extension'/'adapter.js').read_bytes()
            self.send_response(200); self.send_header('Content-Type','text/javascript'); self.send_header('Content-Length',str(len(body))); self.end_headers(); self.wfile.write(body); return
        if parsed.path.startswith(('/play/','/static/','/libs/','/blitz-panel/','/textures/','/fonts/','/models/','/sounds/','/assets/')):
            # A fixed public upstream only. Never forward cookies, authorization or arbitrary hosts.
            upstream='https://editor.joinarcade.ai'+self.path
            try:
                with urllib.request.urlopen(urllib.request.Request(upstream,headers={'User-Agent':'ArcadeVRLab/0.1'}),timeout=25) as response:
                    body=response.read(); mime=response.headers.get('Content-Type','application/octet-stream')
                    if 'text/html' in mime and parsed.path.startswith('/play/'):
                        body=body.replace(b'</body>',b'<script src="/proxy-adapter.js"></script></body>')
                    self.send_response(response.status)
                    self.send_header('Content-Type',mime)
                    self.send_header('Cache-Control','no-store')
                    # Preserve security and embedding policies if the upstream adds them later.
                    for key in ('Content-Security-Policy','X-Frame-Options','Permissions-Policy','Cross-Origin-Opener-Policy','Cross-Origin-Embedder-Policy'):
                        if response.headers.get(key):self.send_header(key,response.headers[key])
                    self.send_header('Content-Length',str(len(body)));self.end_headers();self.wfile.write(body)
            except (urllib.error.URLError,TimeoutError) as error:
                self.json_response({'error':'Public proxy fetch failed','detail':str(error)},502)
            return
        if parsed.path=='/config.js':
            # Only a loopback host serves this token. It is a lab capability, not an Arcade token.
            body=('window.LAB_CONFIG='+json.dumps({'token':TOKEN,'relay':'http://localhost:8765'})+';').encode()
            self.send_response(200); self.send_header('Content-Type','text/javascript'); self.send_header('Cache-Control','no-store'); self.send_header('Content-Length',str(len(body))); self.end_headers(); self.wfile.write(body); return
        if parsed.path=='/api/status':
            if not self.authorized():return self.json_response({'error':'Unauthorized'},403)
            try: after=int(parse_qs(parsed.query).get('after',['0'])[0])
            except ValueError:return self.json_response({'error':'Invalid cursor'},400)
            with LOCK: data=[e for e in EVENTS if e['seq']>after]
            return self.json_response({'events':data})
        super().do_GET()

    def do_POST(self):
        global SEQUENCE
        if not self.authorized():return self.json_response({'error':'Unauthorized'},403)
        origin=self.headers.get('Origin')
        if origin and origin not in ('http://localhost:8765','http://127.0.0.1:8765') and not origin.startswith('chrome-extension://'):
            return self.json_response({'error':'Origin rejected'},403)
        try:
            size=int(self.headers.get('Content-Length','0'))
            if not 0<size<=250000: return self.json_response({'error':'Invalid body size'},413)
            data=json.loads(self.rfile.read(size))
        except (ValueError, json.JSONDecodeError):return self.json_response({'error':'Invalid JSON'},400)
        if self.path=='/api/event':
            event=data.get('event',{})
            if event.get('op') not in OPS or not isinstance(event.get('session'),str):return self.json_response({'error':'Invalid event'},400)
            with LOCK:
                SEQUENCE+=1
                EVENTS.append({'seq':SEQUENCE,'at':time.time(),'event':event})
            return self.json_response({'accepted':True})
        if self.path=='/api/poll':
            session=data.get('session')
            if not isinstance(session,str):return self.json_response({'error':'Missing session'},400)
            with LOCK: commands=COMMANDS.pop(session,[])
            return self.json_response({'commands':commands})
        if self.path=='/api/command':
            session=data.get('session');command=data.get('command',{})
            if not isinstance(session,str) or command.get('op') not in OPS or not isinstance(command.get('id'),str):return self.json_response({'error':'Invalid command'},400)
            with LOCK:
                q=COMMANDS.setdefault(session,[])
                if len(q)>=20:return self.json_response({'error':'Command queue full'},429)
                q.append(command)
            return self.json_response({'queued':True})
        return self.json_response({'error':'Not found'},404)

    def log_message(self,fmt,*args):
        if self.path.startswith('/api/status') or self.path=='/api/poll':return
        super().log_message(fmt,*args)

if __name__=='__main__':
    print('Arcade VR lab: http://localhost:8765 (loopback only)',flush=True)
    ThreadingHTTPServer(('127.0.0.1',8765),Handler).serve_forever()
