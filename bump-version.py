#!/usr/bin/env python3
"""
CSS · JS 파일 주소 뒤에 ?v=... 를 붙여 브라우저가 옛 파일을 계속 쓰지 않도록 합니다.
파일을 고친 뒤 이 스크립트를 한 번 실행하고 커밋하면 됩니다.

    python3 bump-version.py
"""
import re, glob, hashlib, os

ASSETS = ["styles.css", "script.js", "site.js", "reviews.js", "quote.js"]

# 내용이 바뀌면 값도 바뀌도록 해시를 씁니다
ver = hashlib.md5(b"".join(
    open(a, "rb").read() for a in ASSETS if os.path.exists(a)
)).hexdigest()[:8]

for page in glob.glob("*.html"):
    s = open(page, encoding="utf-8").read()
    before = s
    for a in ASSETS:
        s = re.sub(r'(["\'])' + re.escape(a) + r'(\?v=[0-9a-f]+)?\1',
                   r'\g<1>' + a + '?v=' + ver + r'\g<1>', s)
    if s != before:
        open(page, "w", encoding="utf-8").write(s)
        print(f"  {page}  ->  ?v={ver}")
print(f"버전 {ver} 적용 완료")
