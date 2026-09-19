#!/usr/bin/env python3
"""공유 링크(OG) 미리보기 카드 16장을 public/share-cards/ 에 만듭니다.

카드는 브라우저 캔버스로 그립니다(브랜드 서체 Pretendard 를 쓰기 위해서입니다).
이 스크립트는 그 생성기 페이지를 띄워 주고, 페이지가 보내오는 PNG 를 파일로 씁니다.

    python3 scripts/make-share-og.py

안내된 주소를 브라우저로 열면 16장이 저장되고 페이지에 목록이 찍힙니다.
카드 디자인을 바꾸려면 scripts/share-og-card.html 만 고치고 다시 돌리면 됩니다.

주의: 여기서 만든 파일은 리포에 커밋합니다. 서버리스 함수(api/share-og.js)가
`/share-cards/<CODE>.png` 를 og:image 로 가리키므로, 배포에 함께 올라가야 합니다.
"""
from __future__ import annotations

import http.server
import re
import socketserver
import sys
import webbrowser
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
OUT_DIR = ROOT / 'public' / 'share-cards'
PAGE = Path(__file__).resolve().parent / 'share-og-card.html'
FONT_DIR = ROOT / 'public' / 'fonts'
PORT = 8477

NAME_RE = re.compile(r'^[FC][RL][RL][SF]\.png$')
MAX_BYTES = 2_000_000


class Handler(http.server.BaseHTTPRequestHandler):
    def log_message(self, *args):  # 요청 로그는 조용히
        pass

    def _send(self, code: int, body: bytes, ctype: str):
        self.send_response(code)
        self.send_header('Content-Type', ctype)
        self.send_header('Content-Length', str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def do_GET(self):
        if self.path in ('/', '/index.html'):
            return self._send(200, PAGE.read_bytes(), 'text/html; charset=utf-8')
        if self.path.startswith('/fonts/'):
            # 생성기 페이지가 앱과 같은 서체 파일을 쓰도록 그대로 내려 줍니다.
            name = Path(self.path).name
            font = FONT_DIR / name
            if font.is_file():
                return self._send(200, font.read_bytes(), 'font/woff2')
        self._send(404, b'not found', 'text/plain; charset=utf-8')

    def do_POST(self):
        if not self.path.startswith('/save?name='):
            return self._send(404, b'not found', 'text/plain; charset=utf-8')

        name = self.path.split('name=', 1)[1]
        # 파일명은 코드 16개만 허용합니다 — 경로를 넘겨받아 아무 데나 쓰지 않도록.
        if not NAME_RE.match(name):
            return self._send(400, b'bad name', 'text/plain; charset=utf-8')

        length = int(self.headers.get('Content-Length') or 0)
        if length <= 0 or length > MAX_BYTES:
            return self._send(400, b'bad length', 'text/plain; charset=utf-8')

        data = self.rfile.read(length)
        if not data.startswith(b'\x89PNG\r\n\x1a\n'):
            return self._send(400, b'not a png', 'text/plain; charset=utf-8')

        OUT_DIR.mkdir(parents=True, exist_ok=True)
        (OUT_DIR / name).write_bytes(data)
        msg = f'{len(data):,} bytes → public/share-cards/{name}'
        print(' ', msg)
        self._send(200, msg.encode('utf-8'), 'text/plain; charset=utf-8')


def main() -> int:
    if not PAGE.is_file():
        print(f'생성기 페이지가 없습니다: {PAGE}', file=sys.stderr)
        return 1

    url = f'http://127.0.0.1:{PORT}/'
    print(f'생성기: {url}')
    print(f'저장 위치: {OUT_DIR.relative_to(ROOT)}')
    print('브라우저에서 위 주소를 열면 16장이 저장됩니다. 끝나면 Ctrl+C.')
    if '--no-open' not in sys.argv:
        webbrowser.open(url)

    with socketserver.ThreadingTCPServer(('127.0.0.1', PORT), Handler) as httpd:
        httpd.allow_reuse_address = True
        try:
            httpd.serve_forever()
        except KeyboardInterrupt:
            print('\n종료')
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
