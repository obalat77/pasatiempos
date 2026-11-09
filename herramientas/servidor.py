"""Servidor local para desarrollo: como `python3 -m http.server`, pero sin caché del navegador.
Uso: python3 herramientas/servidor.py [puerto]   (por defecto 8000)
"""
import http.server
import sys


class SinCache(http.server.SimpleHTTPRequestHandler):
    extensions_map = {
        **http.server.SimpleHTTPRequestHandler.extensions_map,
        '.js': 'text/javascript',
        '.mjs': 'text/javascript',
        '.webmanifest': 'application/manifest+json',
        '.woff2': 'font/woff2',
    }

    def end_headers(self):
        self.send_header('Cache-Control', 'no-store')
        super().end_headers()


if __name__ == '__main__':
    puerto = int(sys.argv[1]) if len(sys.argv) > 1 else 8000
    print(f'Pasatiempos en http://localhost:{puerto}/')
    http.server.ThreadingHTTPServer(('', puerto), SinCache).serve_forever()
