#!/usr/bin/env python3
"""Fixed-host Arcade proxy with an injected VR player and local experiment relay."""
import os
import gzip
import io
import http.cookies
import argparse
import re
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
from routing import mapping, rewrite

ROOT = pathlib.Path(__file__).resolve().parent
CONFIG_FILE = ROOT / 'extension' / 'config.json'
if CONFIG_FILE.exists():
    TOKEN = json.loads(CONFIG_FILE.read_text())['token']
else:
    TOKEN = secrets.token_urlsafe(32)
    if not os.environ.get('VERCEL'):CONFIG_FILE.write_text(json.dumps({'relay':'http://localhost:8765','token':TOKEN},indent=2))
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
        config=self.proxy_config()
        if not config:return self.send_error(421,'Unknown proxy host')
        if parsed.path.startswith('/__arcade_vr/'):
            name=parsed.path.removeprefix('/__arcade_vr/')
            folder='extension' if name in ('adapter.js','arena.js','engine-host.js','xr-bootstrap.js') else 'web'
            if name not in ('adapter.js','arena.js','engine-host.js','xr-bootstrap.js','site-navigation.js','controller.js','controller.css','xr-compositor.js'):
                return self.send_error(404)
            mime='text/css' if name.endswith('.css') else 'text/javascript'
            return self.file_response(ROOT/folder/name,mime)
        if config['upstream']=='editor.joinarcade.ai' and not config['engine'] and re.fullmatch(r'/play/[a-f0-9-]{36}/?',parsed.path):
            return self.file_response(ROOT/'web'/'controller.html','text/html; charset=utf-8')
        if config['local'] and config['site'] and re.fullmatch(r'/play/[a-f0-9-]{36}/?',parsed.path) and not config['engine']:
            return self.file_response(ROOT/'web'/'controller.html','text/html; charset=utf-8')
        if parsed.path=='/config.js':
            if not config['local']:return self.send_error(404)
            # Only a loopback host serves this token. It is a lab capability, not an Arcade token.
            body=('window.LAB_CONFIG='+json.dumps({'token':TOKEN,'relay':'http://localhost:8765'})+';').encode()
            self.send_response(200); self.send_header('Content-Type','text/javascript'); self.send_header('Cache-Control','no-store'); self.send_header('Content-Length',str(len(body))); self.end_headers(); self.wfile.write(body); return
        if parsed.path=='/api/status':
            if not self.authorized():return self.json_response({'error':'Unauthorized'},403)
            try: after=int(parse_qs(parsed.query).get('after',['0'])[0])
            except ValueError:return self.json_response({'error':'Invalid cursor'},400)
            with LOCK: data=[e for e in EVENTS if e['seq']>after]
            return self.json_response({'events':data})
        if config['local'] and parsed.path in ('/fixture.html','/fixture.js','/lab.html'):
            self.path='/index.html' if parsed.path=='/lab.html' else self.path
            return super().do_GET()
        return self.proxy_request(config)

    def file_response(self,path,mime):
        body=path.read_bytes()
        self.send_response(200)
        self.send_header('Content-Type',mime)
        self.send_header('Cache-Control','no-store')
        self.send_header('Content-Length',str(len(body)))
        self.end_headers();self.wfile.write(body)

    def proxy_config(self):
        proto=self.headers.get('X-Forwarded-Proto','http')
        return mapping(self.headers.get('Host','localhost'),proto if proto in ('http','https') else 'http')

    def proxy_request(self,config):
        # The host map is fixed. This is not an arbitrary-URL/open proxy.
        upstream='https://'+config['upstream']+self.path
        headers={}
        excluded={'host','connection','content-length','accept-encoding','x-forwarded-proto','x-forwarded-host','x-lab-token','if-none-match','if-modified-since'}
        for key,value in self.headers.items():
            if key.lower() not in excluded and not key.lower().startswith(('x-vercel-','x-forwarded-')):headers[key]=rewrite(value,config,reverse=True)
        if 'Cookie' in headers:
            headers['Cookie']='; '.join(pair for pair in headers['Cookie'].split('; ') if not pair.split('=',1)[0].startswith(('_vercel','__vercel')))
        headers['Accept-Encoding']='identity'
        origin=self.headers.get('Origin')
        origin_config=mapping(urlparse(origin).netloc,urlparse(origin).scheme) if origin else None
        if origin_config:headers['Origin']='https://'+origin_config['upstream']
        referer=self.headers.get('Referer')
        if referer:
            ref=urlparse(referer);ref_config=mapping(ref.netloc,ref.scheme)
            if ref_config:headers['Referer']='https://'+ref_config['upstream']+ref.path+('?' + ref.query if ref.query else '')
        body=None
        if self.command not in ('GET','HEAD'):
            size=int(self.headers.get('Content-Length','0'))
            if size>8000000:return self.send_error(413)
            body=self.rfile.read(size)
        try:
            request=urllib.request.Request(upstream,data=body,headers=headers,method=self.command)
            for attempt in range(3):
                try:response=urllib.request.urlopen(request,timeout=40)
                except urllib.error.HTTPError as error:response=error
                if response.status<500 or self.command!='GET' or attempt==2:break
                response.close();time.sleep(.25)
            with response:
                data=response.read();mime=response.headers.get('Content-Type','')
                textual=any(x in mime for x in ('text/','javascript','json','xml'))
                if textual:
                    text=rewrite(data.decode('utf-8'),config)
                    if 'text/html' in mime:
                        if config['engine'] and self.path.split('?')[0].startswith('/play/'):
                            boot=json.dumps({'editor':config['origins']['editor.joinarcade.ai'],'origins':config['origins']})
                            text=text.replace('<head>','<head><script>window.ARCADE_PROXY='+boot+';</script><script src="/__arcade_vr/site-navigation.js"></script><script src="/__arcade_vr/xr-bootstrap.js"></script>',1)
                            text=text.replace('</body>','<script src="/__arcade_vr/adapter.js"></script><script src="/__arcade_vr/arena.js"></script><script src="/__arcade_vr/engine-host.js"></script></body>',1)
                        elif config['site']:
                            boot=json.dumps({'editor':config['origins']['editor.joinarcade.ai'],'origins':config['origins']})
                            text=text.replace('<head>','<head><script>window.ARCADE_PROXY='+boot+';</script><script src="/__arcade_vr/site-navigation.js"></script>',1)
                    data=text.encode('utf-8')
                compressed=textual and len(data)>1000000 and 'gzip' in self.headers.get('Accept-Encoding','')
                if compressed:data=gzip.compress(data,compresslevel=5)
                self.send_response(response.status)
                if compressed:self.send_header('Content-Encoding','gzip')
                excluded_response={'content-length','content-encoding','transfer-encoding','connection','etag','content-md5','cache-control'}
                for key,value in response.headers.items():
                    if key.lower() in excluded_response:continue
                    value=rewrite(value,config)
                    if key.lower()=='access-control-allow-origin' and origin_config:value=origin
                    if key.lower()=='set-cookie':
                        # Keep proxy sessions host-only rather than widening cookie scope.
                        value=re.sub(r';\s*Domain=[^;]+','',value,flags=re.I)
                    self.send_header(key,value)
                self.send_header('Cache-Control','no-store' if textual else response.headers.get('Cache-Control','public, max-age=3600'))
                self.send_header('Content-Length',str(len(data)));self.end_headers()
                if self.command!='HEAD':self.wfile.write(data)
        except (urllib.error.URLError,TimeoutError,UnicodeDecodeError) as error:
            self.json_response({'error':'Arcade upstream unavailable','detail':str(error)},502)

    def do_HEAD(self):
        config=self.proxy_config()
        if not config:return self.send_error(421)
        self.proxy_request(config)

    def do_PUT(self):
        config=self.proxy_config()
        if not config:return self.send_error(421)
        self.proxy_request(config)

    do_PATCH=do_PUT
    do_DELETE=do_PUT
    do_OPTIONS=do_PUT

    def do_POST(self):
        global SEQUENCE
        if self.path not in ('/api/event','/api/poll','/api/command') or not (self.proxy_config() or {}).get('local'):
            config=self.proxy_config()
            if not config:return self.send_error(421)
            return self.proxy_request(config)
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
        super().log_message('%s %s',self.command,urlparse(self.path).path)

if __name__=='__main__':
    parser=argparse.ArgumentParser();parser.add_argument('--port',type=int,default=8765);args=parser.parse_args()
    print(f'Arcade: http://localhost:{args.port} (loopback only)',flush=True)
    ThreadingHTTPServer(('127.0.0.1',args.port),Handler).serve_forever()
