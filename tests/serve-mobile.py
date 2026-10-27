"""Phone preview server: serves app/ live and injects the synthetic Android host.

Never shipped. Usage: py -3.12 tests/serve-mobile.py [port]
Open /index.html?s=connected|fresh|tasks|slow
"""
from pathlib import Path
from http.server import ThreadingHTTPServer, SimpleHTTPRequestHandler
import sys

root = Path(__file__).resolve().parents[1]
app = root / 'app'
mock = root / 'tests' / 'mock-android.js'
port = int(sys.argv[1]) if len(sys.argv) > 1 else 8769


class Handler(SimpleHTTPRequestHandler):
    def __init__(self, *a, **kw):
        super().__init__(*a, directory=str(app), **kw)

    def end_headers(self):
        self.send_header('Cache-Control', 'no-store')
        super().end_headers()

    def do_GET(self):
        path = self.path.split('?', 1)[0]
        if path in ('/', '/index.html'):
            html = (app / 'index.html').read_text(encoding='utf-8')
            html = html.replace('<script src="core.js">', '<script src="mock-android.js"></script><script src="core.js">', 1)
            if 'acceptance=1' in self.path:
                html = html.replace('<script src="ui.js"></script>', '<script src="ui.js"></script><script src="phone-acceptance.js"></script>', 1)
            return self._send(html.encode('utf-8'), 'text/html; charset=utf-8')
        if path == '/frame.html':
            # Fixed 390x844 phone frame for headless screenshots (Chrome's window can't be that narrow).
            query = self.path.split('?', 1)[1] if '?' in self.path else ''
            body = ('<!doctype html><body style="margin:0;background:#888">'
                    '<iframe src="/index.html?' + query.replace('"', '') + '" width="390" height="844" style="border:0;display:block"></iframe>')
            return self._send(body.encode('utf-8'), 'text/html; charset=utf-8')
        if path == '/donate.png':
            # 奶蛙版等分支的界面目录里自带收款码；没有时用发布版的。
            own = app / 'donate.png'
            return self._send((own if own.exists() else root / 'android' / 'public' / 'donate.png').read_bytes(), 'image/png')
        if path in ('/mock-android.js', '/phone-acceptance.js'):
            return self._send((root / 'tests' / path[1:]).read_bytes(), 'text/javascript; charset=utf-8')
        return super().do_GET()

    def _send(self, body, mime):
        self.send_response(200)
        self.send_header('Content-Type', mime)
        self.send_header('Content-Length', str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def log_message(self, *a):
        pass


ThreadingHTTPServer(('127.0.0.1', port), Handler).serve_forever()
