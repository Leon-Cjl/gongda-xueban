"""Run the synthetic UI benchmark without starting resident services."""
from pathlib import Path
import socket, subprocess, sys, tempfile, time

root = Path(sys.argv[1]).resolve()
output = Path(sys.argv[2]).resolve()
runner = Path(__file__).with_name('render-bench.mjs')
def port():
    with socket.socket() as s:
        s.bind(('127.0.0.1', 0))
        return s.getsockname()[1]
http_port, cdp_port = port(), port()
server = subprocess.Popen([sys.executable, str(root / 'tests/serve-mobile.py'), str(http_port)], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
try:
    with tempfile.TemporaryDirectory(prefix='gongda-bench-') as profile:
        chrome = subprocess.Popen([r'C:\Program Files\Google\Chrome\Application\chrome.exe', '--headless=new', '--disable-gpu', '--no-first-run', '--no-default-browser-check', f'--user-data-dir={profile}', f'--remote-debugging-port={cdp_port}', 'about:blank'], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        try:
            time.sleep(1)
            subprocess.run(['node', str(runner), str(cdp_port), f'http://127.0.0.1:{http_port}/index.html?s=connected&motion=off&edition=public&case=benchmark', str(output)], check=True, timeout=90)
        finally:
            subprocess.run(['taskkill', '/PID', str(chrome.pid), '/T', '/F'], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
            chrome.wait(timeout=10)
finally:
    server.terminate()
    server.wait(timeout=10)
