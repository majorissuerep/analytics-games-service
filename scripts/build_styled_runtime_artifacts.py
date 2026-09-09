#!/usr/bin/env python3
"""Build the CPU runtime artifacts used by the deployed Next.js service."""

from __future__ import annotations

import argparse
import hashlib
import json
import shutil
import sys
from collections import defaultdict
from pathlib import Path
from typing import Any

import torch


def sha256_file(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def build_book(source: Path, destination: Path) -> int:
    books: dict[str, dict[str, list[str]]] = defaultdict(dict)
    records = 0
    with source.open(encoding="utf-8") as handle:
        for line_number, line in enumerate(handle, start=1):
            if not line.strip():
                continue
            try:
                record = json.loads(line)
                repertoire = str(record["repertoire_id"])
                history = tuple(str(move) for move in record["move_history"])
                target = str(record["policy_target"])
            except (KeyError, TypeError, json.JSONDecodeError) as error:
                raise ValueError(f"Invalid book record at {source}:{line_number}") from error
            key = " ".join(history)
            targets = books[repertoire].setdefault(key, [])
            if target not in targets:
                targets.append(target)
            records += 1

    payload = {
        repertoire: dict(sorted(entries.items()))
        for repertoire, entries in sorted(books.items())
    }
    destination.write_text(json.dumps(payload, separators=(",", ":"), sort_keys=True), encoding="utf-8")
    return records


class PolicyWrapper(torch.nn.Module):
    def __init__(self, model: torch.nn.Module) -> None:
        super().__init__()
        self.model = model

    def forward(
        self,
        board: torch.Tensor,
        history_ids: torch.Tensor,
        history_mask: torch.Tensor,
        active_elo: torch.Tensor,
        opponent_elo: torch.Tensor,
        time_control: torch.Tensor,
        clock: torch.Tensor,
        repertoire_id: torch.Tensor,
    ) -> tuple[torch.Tensor, torch.Tensor]:
        policy, _, value = self.model(
            board,
            history_ids,
            history_mask,
            active_elo,
            opponent_elo,
            time_control,
            clock,
            repertoire_id,
        )
        return policy, value


def export_model(model_root: Path, checkpoint: Path, destination: Path) -> None:
    sys.path.insert(0, str(model_root / "src"))
    from styled_chess.checkpoint import load_styled_checkpoint
    from styled_chess.features import encode_position, load_otter_vocab

    model, _ = load_styled_checkpoint(checkpoint, device="cpu")
    model.eval()
    torch.backends.mha.set_fastpath_enabled(False)
    vocab = load_otter_vocab()
    encoded = encode_position(
        fen="rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1",
        history_moves=[],
        repertoire_id="white_italian",
        vocab=vocab,
        device="cpu",
    )
    inputs = (
        encoded.board.unsqueeze(0),
        encoded.history_ids.unsqueeze(0),
        encoded.history_mask.unsqueeze(0),
        encoded.active_elo.unsqueeze(0),
        encoded.opponent_elo.unsqueeze(0),
        encoded.time_control.unsqueeze(0),
        encoded.clock.unsqueeze(0),
        encoded.repertoire_id.unsqueeze(0),
    )
    with torch.inference_mode():
        torch.onnx.export(
            PolicyWrapper(model),
            inputs,
            str(destination),
            input_names=[
                "board", "history_ids", "history_mask", "active_elo",
                "opponent_elo", "time_control", "clock", "repertoire_id",
            ],
            output_names=["policy_logits", "value"],
            opset_version=17,
            dynamo=False,
            do_constant_folding=True,
        )


def main() -> int:
    repository = Path(__file__).resolve().parents[1]
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--model-root", type=Path, default=repository.parent / "ml-anti-stockfish-service")
    parser.add_argument("--checkpoint", type=Path)
    parser.add_argument("--book-records", type=Path)
    parser.add_argument("--output-dir", type=Path, default=repository / "public" / "models")
    args = parser.parse_args()

    model_root = args.model_root.resolve()
    checkpoint = (args.checkpoint or model_root / "artifacts" / "pgnmentor-trained.safetensors").resolve()
    book_records = (args.book_records or model_root / "artifacts" / "pgnmentor-corpus" / "train.jsonl").resolve()
    output_dir = args.output_dir.resolve()
    output_dir.mkdir(parents=True, exist_ok=True)
    onnx_path = output_dir / "styled-opening.onnx"
    export_model(model_root, checkpoint, onnx_path)

    import otter_chess

    vocab_dir = Path(otter_chess.__file__).resolve().parent / "vocab"
    shutil.copyfile(vocab_dir / "policy_move_to_id.json", output_dir / "styled-policy-vocab.json")
    shutil.copyfile(vocab_dir / "history_move_to_id.json", output_dir / "styled-history-vocab.json")
    record_count = build_book(book_records, output_dir / "styled-opening-book.json")
    metadata: dict[str, Any] = {
        "format_version": 1,
        "model_type": "styled_otter_cpu_onnx",
        "opset": 17,
        "checkpoint_sha256": sha256_file(checkpoint),
        "onnx_sha256": sha256_file(onnx_path),
        "book_records": record_count,
        "repertoires": ["white_italian", "white_queen_gambit", "black_caro_kann", "black_slav"],
        "runtime": "onnxruntime-web WASM CPU",
    }
    (output_dir / "styled-opening.metadata.json").write_text(
        json.dumps(metadata, indent=2, sort_keys=True) + "\n", encoding="utf-8"
    )
    print(json.dumps(metadata, indent=2, sort_keys=True))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
