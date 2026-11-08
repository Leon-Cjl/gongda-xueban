"""Run tests/phone-acceptance.js in headless Chrome at phone size against the synthetic Android host.

Usage: py -3.12 tests/run-phone-acceptance.py   (starts serve-mobile.py on a free port, prints the result)
"""
from pathlib import Path
import argparse, json, re, socket, subprocess, sys, tempfile, time, html
parser = argparse.ArgumentParser()
parser.add_argument("--app-dir", type=Path)
parser.add_argument("--public", action="store_true")
parser.add_argument("scenarios", nargs="*")
args = parser.parse_args()

root = Path(__file__).resolve().parents[1]
chrome = Path(r'C:\Program Files\Google\Chrome\Application\chrome.exe')
with socket.socket() as s:
    s.bind(('127.0.0.1', 0)); port = s.getsockname()[1]
server = subprocess.Popen([sys.executable, str(root / 'tests/serve-mobile.py'), str(port)] + ([str(args.app_dir.resolve())] if args.app_dir else []))
results = {}
try:
    time.sleep(1)
    cases = {'main': 's=connected&notify=on&vio=1&case=main', 'menu': 's=connected&teach=menu&teachauto=menu&case=menu', 'auto': 's=connected&autologin=ok&case=auto', 'autofail': 's=connected&autologin=fail&case=autofail', 'offline': 's=connected&case=offline', 'medal': 's=connected&badges=none&motion=auto&case=medal', 'public': 's=connected&edition=public&case=public', 'publicpc': 's=connected&edition=public&platform=windows&case=publicpc', 'reconcile': 's=tasks&platform=windows&case=reconcile', 'bigrooms': 's=connected&teach=off&seedcache=1&rooms=600&case=bigrooms', 'thanks': 's=connected&edition=public&opens=99&case=thanks', 'thanksoff': 's=connected&edition=public&opens=99&donatehidden=1&case=thanksoff'}
    cases['exams'] = 's=connected&case=exams'
    cases['readdeadline'] = 's=connected&case=readdeadline'
    cases['roomrace'] = 's=connected&case=roomrace'
    cases['dialogfocus'] = 's=connected&case=dialogfocus'
    cases['adapteraudit'] = 's=connected&case=adapteraudit'
    for case in ('seatcontinuity', 'tabcontinuity', 'progressmotion','inputcontinuity','fallbackui','calendarpreview','seats80','seats300','seats1000','readingupdates','renderduringtap'):
        cases[case] = f's=connected&case={case}'
    cases['batchundo'] = 's=connected&case=batchundo'
    cases['research'] = 's=connected&edition=public&case=research'
    # 只跑指定的几个：py -3.12 tests/run-phone-acceptance.py offline bigrooms
    selected = args.scenarios
    if selected: cases = {k: v for k, v in cases.items() if k in selected}
    if not cases: raise SystemExit('No matching acceptance scenarios')
    if args.public:
        cases = {k: v if 'edition=' in v else v + '&edition=public' for k, v in cases.items()}
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
