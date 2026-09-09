# Tuned Opening CPU runtime

These files are the checked-in deployment artifact for the built-in `Tuned Opening Style` chess opponent.

- `styled-opening.onnx` is the selector-conditioned Otter policy exported for ONNX opset 17.
- `styled-opening-book.json` contains the compact opening-book index generated from the validated training corpus.
- `styled-policy-vocab.json` and `styled-history-vocab.json` are the exact Otter vocabularies used by the model.
- `ort-wasm-simd-threaded.mjs` and `ort-wasm-simd-threaded.wasm` are the pinned ONNX Runtime CPU WASM loader files.
- `styled-opening.metadata.json` records source and deployment artifact hashes.

Regenerate from the sibling model project with:

```bash
C:/Users/roman/ml-anti-stockfish-service/.venv/Scripts/python.exe scripts/build_styled_runtime_artifacts.py --model-root C:/Users/roman/ml-anti-stockfish-service
```

The Next.js route loads the ONNX graph in Node through `onnxruntime-web` with one CPU thread. The Python sidecar is optional and is not required by production.
