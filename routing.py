"""Fixed Arcade upstreams, identical URL paths, configurable deployment domain."""
import os
from urllib.parse import urlsplit
DOMAIN=os.environ.get('ARCADE_DOMAIN','danielbacsur.dev').strip('.')
WWW='www.tryarcade.com';EDITOR='editor.joinarcade.ai';DASHBOARD='dashboard.joinarcade.ai';API='arcade-ai-api-700875384378.europe-west1.run.app'
STORAGE='storage.googleapis.com'
LOCAL={'localhost':WWW,'127.0.0.1':WWW,'www.tryarcade.localhost':WWW,'site.localhost':WWW,'editor.localhost':EDITOR,'editor.joinarcade.localhost':EDITOR,'runtime.localhost':EDITOR,'runtime.joinarcade.localhost':EDITOR,'dashboard.joinarcade.localhost':DASHBOARD,'api.joinarcade.localhost':API,'storage.joinarcade.localhost':STORAGE}
PUBLIC={f'www.tryarcade.{DOMAIN}':WWW,f'editor.joinarcade.{DOMAIN}':EDITOR,f'runtime.joinarcade.{DOMAIN}':EDITOR,f'dashboard.joinarcade.{DOMAIN}':DASHBOARD,f'api.joinarcade.{DOMAIN}':API,f'storage.joinarcade.{DOMAIN}':STORAGE}

def mapping(authority,scheme='http'):
    host=urlsplit('//'+authority).hostname
    previews={os.environ.get('VERCEL_URL'),os.environ.get('VERCEL_PROJECT_PRODUCTION_URL')}
    upstream=LOCAL.get(host) or PUBLIC.get(host) or (WWW if host in previews else None)
    if not upstream:return None
    local=host in LOCAL
    port=urlsplit('//'+authority).port
    suffix=(':'+str(port)) if port else ''
    if local:
        hosts={WWW:'localhost'+suffix,EDITOR:'editor.joinarcade.localhost'+suffix,DASHBOARD:'dashboard.joinarcade.localhost'+suffix,API:'api.joinarcade.localhost'+suffix,STORAGE:'storage.joinarcade.localhost'+suffix}
        runtime='runtime.joinarcade.localhost'+suffix
    else:
        hosts={WWW:f'www.tryarcade.{DOMAIN}'+suffix,EDITOR:f'editor.joinarcade.{DOMAIN}'+suffix,DASHBOARD:f'dashboard.joinarcade.{DOMAIN}'+suffix,API:f'api.joinarcade.{DOMAIN}'+suffix,STORAGE:f'storage.joinarcade.{DOMAIN}'+suffix}
        runtime=f'runtime.joinarcade.{DOMAIN}'+suffix
    is_runtime=host.startswith('runtime.')
    if is_runtime:hosts[EDITOR]=authority
    return {'upstream':upstream,'origins':{k:scheme+'://'+v for k,v in hosts.items()},'runtime':scheme+'://'+runtime,'local':local,'engine':is_runtime,'site':upstream==WWW}

def rewrite(text,config,reverse=False):
    for host,origin in config['origins'].items():
        old,new=(origin,'https://'+host) if reverse else ('https://'+host,origin)
        text=text.replace(old,new).replace(old.replace('/','\\/'),new.replace('/','\\/'))
    return text
