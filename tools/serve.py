"""Dev server for the site, serving the SITE ROOT with caching disabled.

    python tools/serve.py                         # then http://127.0.0.1:8777/

Use this instead of `python -m http.server 8777`.

`http.server` sends no Cache-Control header at all. With no explicit directive a
browser is free to apply heuristic freshness — roughly a tenth of the time since
Last-Modified — and serve a stylesheet from cache without revalidating. That bit
hard once: an edit to scene.js was picked up while the matching style.css was not,
so clicking a block unhid a completely unstyled panel. The descent froze, as it is
meant to, and nothing was visible, because the element had no position, no z-index
and no size and was sitting far down a 2000vh page.

Symptom to remember: new behaviour, old appearance. It is almost always this.

IT ALSO SERVES BYTE RANGES, which `http.server` does not. Without them a
<video> reports an empty `seekable` range, so its scrub bar does nothing: you
cannot drag the bead and clicking the timeline is ignored. Nothing is wrong with
the page when that happens — GitHub Pages answers a Range request with 206 and
the deployed videos scrub fine — but the local copy behaves like a broken player
and sends you hunting through the player code. Serve the same thing the host
serves.
"""
import functools
import http.server
import os
import re
import socketserver

PORT = 8777
ROOT = os.path.abspath(os.path.join(os.path.dirname(os.path.abspath(__file__)), '..'))
RANGE_RE = re.compile(r'^bytes=(\d*)-(\d*)$')


class NoCache(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header('Cache-Control', 'no-store, no-cache, must-revalidate')
        self.send_header('Pragma', 'no-cache')
        self.send_header('Expires', '0')
        super().end_headers()

    def send_head(self):
        """Answer a single byte range with 206, else defer to the base class.

        Only one range is handled, which is all a media element asks for. A
        multipart/byteranges reply is legal but nothing here needs it, and a
        wrong one is worse than none: falling through to a plain 200 is always
        a valid answer to a Range request.
        """
        header = self.headers.get('Range')
        if not header:
            return super().send_head()
        m = RANGE_RE.match(header.strip())
        if not m:
            return super().send_head()

        path = self.translate_path(self.path)
        if os.path.isdir(path):
            return super().send_head()
        try:
            f = open(path, 'rb')
        except OSError:
            self.send_error(404, 'File not found')
            return None

        size = os.fstat(f.fileno()).st_size
        first, last = m.group(1), m.group(2)
        if first == '':                       # "bytes=-500": the FINAL 500 bytes
            if last == '':
                f.close()
                return super().send_head()
            start = max(0, size - int(last))
            end = size - 1
        else:
            start = int(first)
            end = int(last) if last else size - 1
            end = min(end, size - 1)

        if start >= size or start > end:
            f.close()
            self.send_response(416, 'Requested Range Not Satisfiable')
            self.send_header('Content-Range', 'bytes */%d' % size)
            self.send_header('Content-Length', '0')
            self.end_headers()
            return None

        self.send_response(206, 'Partial Content')
        self.send_header('Content-Type', self.guess_type(path))
        self.send_header('Accept-Ranges', 'bytes')
        self.send_header('Content-Range', 'bytes %d-%d/%d' % (start, end, size))
        self.send_header('Content-Length', str(end - start + 1))
        self.send_header('Last-Modified', self.date_time_string(
            os.fstat(f.fileno()).st_mtime))
        self.end_headers()
        f.seek(start)
        # Hand back a reader bounded to the range. copyfile() would otherwise
        # run to EOF and send more bytes than Content-Length promised.
        return _Bounded(f, end - start + 1)

    def log_message(self, fmt, *args):        # quiet: one line per request is noise
        pass


class _Bounded:
    """Read-only file wrapper that stops after `remaining` bytes."""

    def __init__(self, fp, remaining):
        self._fp = fp
        self._remaining = remaining

    def read(self, n=-1):
        if self._remaining <= 0:
            return b''
        if n is None or n < 0 or n > self._remaining:
            n = self._remaining
        chunk = self._fp.read(n)
        self._remaining -= len(chunk)
        return chunk

    def close(self):
        self._fp.close()


class Server(socketserver.ThreadingTCPServer):
    allow_reuse_address = True                # so a restart does not wait on TIME_WAIT
    daemon_threads = True


if __name__ == '__main__':
    handler = functools.partial(NoCache, directory=ROOT)
    with Server(('127.0.0.1', PORT), handler) as httpd:
        print(f'serving {ROOT} on http://127.0.0.1:{PORT} with caching disabled')
        print(f'  meet the processor: http://127.0.0.1:{PORT}/meet-the-processor/')
        try:
            httpd.serve_forever()
        except KeyboardInterrupt:
            pass
