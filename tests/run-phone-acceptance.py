"""Run tests/phone-acceptance.js in headless Chrome at phone size against the synthetic Android host.

Usage: py -3.12 tests/run-phone-acceptance.py   (starts serve-mobile.py on a free port, prints the result)
"""
from pathlib import Path
import json, re, socket, subprocess, sys, tempfile, time, html

root = Path(__file__).resolve().parents[1]
chrome = Path(r'C:\Program Files\Google\Chrome\Application\chrome.exe')
with socket.socket() as s:
    s.bind(('127.0.0.1', 0)); port = s.getsockname()[1]
server = subprocess.Popen([sys.executable, str(root / 'tests/serve-mobile.py'), str(port)])
results = {}
try:
    time.sleep(1)
    cases = {'main': 's=connected&notify=on&vio=1&case=main', 'menu': 's=connected&teach=menu&teachauto=menu&case=menu', 'auto': 's=connected&autologin=ok&case=auto', 'autofail': 's=connected&autologin=fail&case=autofail', 'offline': 's=connected&case=offline', 'medal': 's=connected&badges=none&motion=auto&case=medal', 'public': 's=connected&edition=public&case=public', 'publicpc': 's=connected&edition=public&platform=windows&case=publicpc', 'reconcile': 's=tasks&platform=windows&case=reconcile', 'bigrooms': 's=connected&teach=off&seedcache=1&rooms=600&case=bigrooms', 'thanks': 's=connected&edition=public&opens=99&case=thanks', 'thanksoff': 's=connected&edition=public&opens=99&donatehidden=1&case=thanksoff'}
    # 只跑指定的几个：py -3.12 tests/run-phone-acceptance.py offline bigrooms
    if len(sys.argv) > 1: cases = {k: v for k, v in cases.items() if k in sys.argv[1:]}
    for name, query in cases.items():
        with tempfile.TemporaryDirectory() as profile:
            # The page itself is 390px wide inside a frame-less window; Chrome's minimum window width is larger,
            # so the app is loaded in an iframe of phone size and the result is read from the frame's DOM via --dump-dom of a wrapper.
            url = f'http://127.0.0.1:{port}/index.html?{query}&acceptance=1&motion=off'
            run = subprocess.run([str(chrome), '--headless=new', '--disable-gpu', '--no-first-run', f'--user-data-dir={profile}',
                                  '--window-size=390,844', '--virtual-time-budget=300000', '--dump-dom', url],
                                 capture_output=True, text=True, encoding='utf-8', timeout=180)
        found = re.search(r'<pre id="qa-result">(.*?)</pre>', run.stdout, re.S)
        results[name] = json.loads(html.unescape(found.group(1))) if found else {'ok': False, 'error': 'no result', 'tail': run.stdout[-400:]}
finally:
    server.terminate()
print(json.dumps(results, ensure_ascii=False, indent=1))
sys.exit(0 if all(r.get('ok') for r in results.values()) else 1)
