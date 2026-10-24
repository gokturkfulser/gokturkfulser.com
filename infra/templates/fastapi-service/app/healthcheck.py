"""Konteyner healthcheck'i: curl/wget gerektirmez. Sağlıklıysa 0, değilse 1 ile çıkar."""

import sys
import urllib.request

from app.config import get_settings


def main() -> int:
    url = f"http://127.0.0.1:{get_settings().port}/health"
    try:
        with urllib.request.urlopen(url, timeout=3) as response:  # noqa: S310 (sabit http URL)
            return 0 if response.status == 200 else 1
    except OSError:
        return 1


if __name__ == "__main__":
    sys.exit(main())
