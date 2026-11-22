"""Заполняет демо-контентом и по запросу синтетическими данными."""

import argparse
import json
from pathlib import Path

from app.config import get_settings

DATA = Path(__file__).with_name("data.json")


def main() -> None:
    parser = argparse.ArgumentParser(description="Seed development data")
    parser.add_argument(
        "--demo",
        action="store_true",
        help="also create synthetic demo users and learning history",
    )
    args = parser.parse_args()

    if get_settings().app_env != "dev":
        raise SystemExit("Seeding is allowed only when APP_ENV=dev")

    from app.seed.runner import seed

    data = json.loads(DATA.read_text(encoding="utf-8"))
    print(seed(data, include_demo=args.demo))


if __name__ == "__main__":
    main()
