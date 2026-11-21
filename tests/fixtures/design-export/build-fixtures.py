#!/usr/bin/env python3
"""Builds the design-export fixtures for tests/unit/test-design-export-inspect.sh.

Archives are written at test time into the folder given as argv[1], so no
binary file is committed. Python writes entry names exactly as given, which
the zip command line tool would normalise away ("../x", "/abs", "..\\x").
"""

import gzip
import io
import os
import stat
import sys
import tarfile
import warnings
import zipfile

box = sys.argv[1]
HTML = (
    "<!doctype html><html><head><style>:root{--brand:#0a7;--gap:8px}</style></head>"
    '<body><section id="hero">Hi</section></body></html>'
)


def make_zip(name, members):
    with zipfile.ZipFile(os.path.join(box, name), "w", zipfile.ZIP_DEFLATED) as f:
        for entry, data in members:
            f.writestr(entry, data)


def add(tar, name, text):
    body = text.encode()
    info = tarfile.TarInfo(name)
    info.size = len(body)
    tar.addfile(info, io.BytesIO(body))


# readable exports
make_zip(
    "good.zip",
    [
        ("Pricing/index.html", HTML),
        ("Pricing/Detail.html", HTML),
        ("Pricing/styles/tokens.css", ":root{--brand:#0a7}"),
        ("Pricing/assets/logo.svg", "<svg/>"),
    ],
)
make_zip("renamed.bin", [("Pricing/index.html", HTML)])
make_zip("no-html.zip", [("Notes/notes.md", "nothing drawn yet")])
make_zip("two-pages.zip", [("b.html", HTML), ("a.html", HTML)])

# hostile archives
make_zip("traversal.zip", [("ok.html", HTML), ("../escaped.html", HTML)])
make_zip("absolute.zip", [("/tmp/abs-escaped.html", HTML)])
make_zip("backslash.zip", [("..\\escaped.html", HTML)])

with zipfile.ZipFile(os.path.join(box, "symlink.zip"), "w") as f:
    info = zipfile.ZipInfo("link.html")
    info.create_system = 3
    info.external_attr = (stat.S_IFLNK | 0o777) << 16
    f.writestr(info, "/etc/hosts")

# a size field that lies: the directory says 10 bytes, the entry holds far more
raw = io.BytesIO()
with zipfile.ZipFile(raw, "w", zipfile.ZIP_DEFLATED) as f:
    f.writestr("big.html", "A" * 200000)
data = bytearray(raw.getvalue())
directory = data.rfind(b"PK\x01\x02")
data[directory + 24 : directory + 28] = (10).to_bytes(4, "little")
with open(os.path.join(box, "lying-size.zip"), "wb") as out:
    out.write(bytes(data))

# the same lie on a STORED entry: it is written as is, so the reader must
# compare its two size fields instead of relying on the inflate limit
raw = io.BytesIO()
with zipfile.ZipFile(raw, "w", zipfile.ZIP_STORED) as f:
    f.writestr("big.html", "A" * 200000)
data = bytearray(raw.getvalue())
directory = data.rfind(b"PK\x01\x02")
data[directory + 24 : directory + 28] = (10).to_bytes(4, "little")
with open(os.path.join(box, "stored-lying-size.zip"), "wb") as out:
    out.write(bytes(data))

# one name used as a file and as a folder, and one name used twice
make_zip("clash.zip", [("page", HTML), ("page/inner.html", HTML)])
with warnings.catch_warnings():
    warnings.simplefilter("ignore")
    make_zip("duplicate.zip", [("page.html", HTML), ("page.html", "<html>other</html>")])

# attack on the clash check: a name deeper or longer than the caps must be
# refused before any prefix work, even when it arrives as a GNU long name
make_zip("deep-name.zip", [("/".join(["d"] * 40) + "/page.html", HTML)])
make_zip("long-name.zip", [("n" * 600 + ".html", HTML)])
with tarfile.open(os.path.join(box, "tar-deep-name.tar.gz"), "w:gz") as t:
    add(t, "/".join(["d"] * 40) + "/page.html", HTML)

# a tar header with a negative size, which would send a naive reader backwards
header = bytearray(512)
header[0:1] = b"x"
header[124:132] = b"-0001000"
header[156:157] = b"5"
with gzip.open(os.path.join(box, "tar-negative-size.tar.gz"), "wb") as out:
    out.write(bytes(header) + bytes(1024))

# many pages: the inventory is larger than one pipe buffer (64 KB)
make_zip(
    "many-pages.zip",
    [(f"screens/section-{i:04d}/page-with-a-long-name-{i:04d}.html", HTML) for i in range(1900)],
)

# standalone-site handoff bundle (the site closes on 2026-12-14)
with tarfile.open(os.path.join(box, "legacy.tar.gz"), "w:gz") as t:
    add(t, "proj/README.md", "CODING AGENTS: READ THIS FIRST")
    add(t, "proj/chats/chat1.md", "user asked for a landing page")
    add(t, "proj/project/Landing.html", HTML)
    add(t, "proj/project/Other.html", HTML)
with tarfile.open(os.path.join(box, "legacy-incomplete.tar.gz"), "w:gz") as t:
    add(t, "proj/README.md", "CODING AGENTS: READ THIS FIRST")
    add(t, "proj/chats/chat1.md", "assistant asked a question")
with tarfile.open(os.path.join(box, "tar-traversal.tar.gz"), "w:gz") as t:
    add(t, "../tar-escaped.html", HTML)
with tarfile.open(os.path.join(box, "tar-link.tar.gz"), "w:gz") as t:
    link = tarfile.TarInfo("proj/link")
    link.type = tarfile.SYMTYPE
    link.linkname = "/etc/hosts"
    t.addfile(link)

# plain files and a folder
with open(os.path.join(box, "standalone.html"), "w") as out:
    out.write(HTML)
with open(os.path.join(box, "plain.txt"), "w") as out:
    out.write("just text, not an export")
os.makedirs(os.path.join(box, "folder", "screens"))
with open(os.path.join(box, "folder", "screens", "Home.html"), "w") as out:
    out.write(HTML)
