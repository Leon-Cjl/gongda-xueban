"""Phone screenshots with the synthetic Android host, composed into dist/phone-overview.png.

Never contacts the school. Usage: py -3.12 tests/phone-overview.py
"""
from pathlib import Path
import socket, subprocess, sys, tempfile, time
from PIL import Image, ImageDraw, ImageFont

root = Path(__file__).resolve().parents[1]
chrome = Path(r'C:\Program Files\Google\Chrome\Application\chrome.exe')
shots = [
    ('图书馆 · 区域筛选', 's=connected&notify=on&theme=light&accent=blue'),
    ('教室全天占用 · 深色', 's=connected&theme=dark&page=rooms&query=1&roomday=104'),
    ('空教室 · 离线查询', 's=connected&teach=off&theme=light&page=rooms&seedcache=1&query=1'),
    ('我的 · 到馆日历与勋章', 's=connected&notify=on&theme=light&page=me&scrollto=.cal'),
    ('新勋章', 's=connected&badges=none&theme=light&motion=off'),
]
with socket.socket() as s:
    s.bind(('127.0.0.1', 0)); port = s.getsockname()[1]
server = subprocess.Popen([sys.executable, str(root / 'tests/serve-mobile.py'), str(port)])
images = []
try:
    time.sleep(1)
    for title, query in shots:
        with tempfile.TemporaryDirectory() as profile:
            out = Path(profile) / 'shot.png'
            subprocess.run([str(chrome), '--headless=new', '--disable-gpu', '--no-first-run', '--hide-scrollbars', f'--user-data-dir={profile}',
                            '--window-size=500,900', '--virtual-time-budget=15000', f'--screenshot={out}',
                            f'http://127.0.0.1:{port}/frame.html?{query}&motion=off'], capture_output=True, timeout=120)
            images.append((title, Image.open(out).convert('RGB').crop((0, 0, 390, 844))))
finally:
    server.terminate()
font = ImageFont.truetype(r'C:\Windows\Fonts\msyh.ttc', 22)
gap, head = 28, 56
sheet = Image.new('RGB', (len(images) * 390 + (len(images) + 1) * gap, 844 + head + gap), '#e9e9ee')
draw = ImageDraw.Draw(sheet)
for i, (title, im) in enumerate(images):
    x = gap + i * (390 + gap)
    draw.text((x, 16), title, fill='#333333', font=font)
    sheet.paste(im, (x, head))
target = root / 'dist' / 'phone-overview.png'
target.parent.mkdir(exist_ok=True)
sheet.save(target)
print(target, sheet.size)
