from pathlib import Path
import shutil
from http.server import ThreadingHTTPServer, SimpleHTTPRequestHandler
root=Path(__file__).resolve().parents[1]
out=root/'research/ui-qa'
out.mkdir(exist_ok=True)
for p in (root/'app').iterdir():
 if p.is_file():shutil.copy2(p,out/p.name)
shutil.copy2(root/'tests/mock-host.js',out/'mock-host.js')
index=out/'index.html'
s=index.read_text(encoding='utf-8').replace('<script src="core.js">','<script src="mock-host.js"></script><script src="core.js">').replace('<title>工大学伴</title>','<title>工大学伴 · 界面验收（模拟数据）</title>')
index.write_text(s,encoding='utf-8')
class Handler(SimpleHTTPRequestHandler):
 def __init__(self,*a,**kw):super().__init__(*a,directory=str(out),**kw)
 def log_message(self,*a):pass
ThreadingHTTPServer(('127.0.0.1',8768),Handler).serve_forever()
