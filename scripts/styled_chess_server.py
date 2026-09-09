#!/usr/bin/env python3
"""Local HTTP sidecar for the selector-conditioned styled chess checkpoint.

The sidecar intentionally imports the already-trained model project instead of
reimplementing its encoder or checkpoint format. It binds to loopback by
 default and exposes only JSON inference plus a health endpoint.
"""

from __future__ import annotations

import argparse
import json
import os
import sys
import threading
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from typing import Any


MAX_BODY_BYTES = 64 * 1024
DEFAULT_PORT = 8765


def default_model_root() -> Path:
    # The two repositories are siblings in the local development layout.
    return Path(__file__).resolve().parents[1].parent / "ml-anti-stockfish-service"


def _read_book_records(path: Path) -> list[dict[str, Any]]:
    """Read the local pipeline's already-validated JSONL book without replaying it."""
    records: list[dict[str, Any]] = []
    with path.open('r', encoding='utf-8') as handle:
        for line_number, line in enumerate(handle, start=1):
            if not line.strip():
                continue
            try:
                record = json.loads(line)
            except json.JSONDecodeError as error:
                raise ValueError(f'Invalid opening-book JSON at {path}:{line_number}') from error
            if not isinstance(record, dict):
                raise ValueError(f'Opening-book record at {path}:{line_number} is not an object')
            records.append(record)
    return records


class StyledChessService:
    def __init__(self, root: Path, checkpoint: Path, device: str, book_paths: list[Path]) -> None:
        root = root.resolve()
        sys.path.insert(0, str(root / "src"))

        import torch
        from styled_chess.checkpoint import load_styled_checkpoint
        from styled_chess.features import load_otter_vocab
        from styled_chess.opening_book import OpeningBook, StyledRepertoireAgent
        from styled_chess.predictor import StyledPredictor

        if device == "cuda" and not torch.cuda.is_available():
            raise RuntimeError("CUDA was requested but is not available")
        self.device = device
        self.checkpoint = checkpoint.resolve()
        if not self.checkpoint.is_file():
            raise FileNotFoundError(f"Styled checkpoint not found: {self.checkpoint}")

        model, _ = load_styled_checkpoint(self.checkpoint, device=device)
        predictor = StyledPredictor(model, vocab=load_otter_vocab(), device=device)
        policy: Any = predictor
        records: list[dict[str, Any]] = []
        for path in book_paths:
            if path.is_file():
                records.extend(_read_book_records(path))
        if records:
            policy = StyledRepertoireAgent(predictor, OpeningBook.from_records(records))
        self.policy = policy
        self.lock = threading.Lock()

    def predict(self, payload: dict[str, Any]) -> dict[str, Any]:
        fen = payload.get("fen")
        history = payload.get("history", [])
        repertoire_id = payload.get("repertoire_id")
        if not isinstance(fen, str) or not fen:
            raise ValueError("fen must be a non-empty string")
        if not isinstance(history, list) or not all(isinstance(move, str) for move in history):
            raise ValueError("history must be a list of UCI strings")
        if len(history) > 1000:
            raise ValueError("history is too long")
        if not isinstance(repertoire_id, str) or not repertoire_id:
            raise ValueError("repertoire_id is required")

        with self.lock:
            result = self.policy.predict(
                fen=fen,
                history_moves=history,
                repertoire_id=repertoire_id,
                top_k=5,
            )
        return result


class Handler(BaseHTTPRequestHandler):
    service: StyledChessService

    def _json(self, status: int, payload: dict[str, Any]) -> None:
        encoded = json.dumps(payload, separators=(",", ":"), allow_nan=False).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(encoded)))
        self.send_header("Cache-Control", "no-store")
        self.end_headers()
        self.wfile.write(encoded)

    def do_GET(self) -> None:  # noqa: N802
        if self.path == "/healthz":
            self._json(200, {"status": "ready", "device": self.service.device})
            return
        self._json(404, {"error": "Not found"})

    def do_POST(self) -> None:  # noqa: N802
        if self.path != "/predict":
            self._json(404, {"error": "Not found"})
            return
        try:
            content_length = int(self.headers.get("content-length", "-1"))
        except ValueError:
            content_length = -1
        if content_length < 0 or content_length > MAX_BODY_BYTES:
            self._json(413, {"error": "Request body is too large"})
            return
        try:
            payload = json.loads(self.rfile.read(content_length))
            if not isinstance(payload, dict):
                raise ValueError("request must be a JSON object")
            result = self.service.predict(payload)
            self._json(200, result)
        except (ValueError, json.JSONDecodeError) as error:
            self._json(400, {"error": str(error)})
        except Exception:
            print("styled-chess inference failed", file=sys.stderr)
            self._json(500, {"error": "Styled model inference failed"})

    def log_message(self, format: str, *args: Any) -> None:
        print(f"styled-chess: {format % args}", file=sys.stderr)


def main() -> int:
    parser = argparse.ArgumentParser(description="Serve the local styled chess checkpoint")
    parser.add_argument("--host", default=os.environ.get("STYLED_CHESS_HOST", "127.0.0.1"))
    parser.add_argument("--port", type=int, default=int(os.environ.get("STYLED_CHESS_PORT", DEFAULT_PORT)))
    parser.add_argument("--device", default=os.environ.get("STYLED_CHESS_DEVICE", ""))
    args = parser.parse_args()

    root = Path(os.environ.get("STYLED_CHESS_ROOT", default_model_root()))
    checkpoint = Path(os.environ.get(
        "STYLED_CHESS_CHECKPOINT",
        root / "artifacts" / "pgnmentor-trained.safetensors",
    ))
    device = args.device or _default_device()
    configured_books = os.environ.get("STYLED_CHESS_BOOK_RECORDS", "")
    if configured_books:
        book_paths = [Path(value) for value in configured_books.split(os.pathsep) if value]
    else:
        default_book = root / "artifacts" / "pgnmentor-corpus" / "train.jsonl"
        book_paths = [default_book] if default_book.is_file() else []

    service = StyledChessService(root, checkpoint, device, book_paths)
    Handler.service = service
    server = ThreadingHTTPServer((args.host, args.port), Handler)
    print(f"styled-chess ready on http://{args.host}:{args.port} ({device})", flush=True)
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass
    finally:
        server.server_close()
    return 0


def _default_device() -> str:
    try:
        import torch
        return "cuda" if torch.cuda.is_available() else "cpu"
    except ImportError:
        return "cpu"


if __name__ == "__main__":
    raise SystemExit(main())
