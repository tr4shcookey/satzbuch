# Setzt eine neue Version im Service Worker, damit installierte Apps das Update laden.
import datetime, re, pathlib
p = pathlib.Path(__file__).resolve().parent.parent / "sw.js"
v = datetime.datetime.now(datetime.UTC).strftime("%Y%m%d%H%M")
p.write_text(re.sub(r'const VERSION = "[^"]*";', f'const VERSION = "satzbuch-{v}";', p.read_text()))
print("Version", v)
