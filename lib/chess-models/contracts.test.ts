import { afterEach, describe, expect, it, vi } from 'vitest'
import { chessModelSubmissionSchema, adminDecisionSchema } from './contracts'
import { inspectHuggingFaceRevision } from './huggingface'

afterEach(() => vi.unstubAllGlobals())

describe('safe Chess model contracts', () => {
  it('accepts immutable Hugging Face submissions', () => {
    expect(chessModelSubmissionSchema.safeParse({
      source: 'huggingface', name: 'tactical-otter', displayName: 'Tactical Otter', description: '',
      runtime: 'hf-transformers-chess-v1', license: 'apache-2.0', repoId: 'example/chess-model',
      revision: 'a'.repeat(40),
    }).success).toBe(true)
  })

  it('rejects mutable revisions, executable runtimes, and oversized uploads', () => {
    expect(chessModelSubmissionSchema.safeParse({ source: 'huggingface', name: 'unsafe', displayName: 'Unsafe', runtime: 'python', license: 'x', repoId: 'a/b', revision: 'main' }).success).toBe(false)
    expect(chessModelSubmissionSchema.safeParse({ source: 'direct', name: 'huge-model', displayName: 'Huge model', description: '', runtime: 'onnx-policy-v1', license: 'mit', fileName: 'model.zip', sizeBytes: 1_073_741_825, sha256: 'a'.repeat(64) }).success).toBe(false)
  })

  it('requires a reason when an admin rejects a revision', () => {
    expect(adminDecisionSchema.safeParse({ decision: 'reject' }).success).toBe(false)
    expect(adminDecisionSchema.safeParse({ decision: 'reject', reason: 'Unsupported operators' }).success).toBe(true)
  })

  it('rejects forbidden files in Hugging Face revisions', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({
      sha: 'b'.repeat(40), siblings: [{ rfilename: 'model.safetensors', size: 10 }, { rfilename: 'modeling.py', size: 10 }],
    }), { status: 200 })))
    await expect(inspectHuggingFaceRevision('org/model', 'b'.repeat(40))).rejects.toThrow('forbidden file')
  })

  it('accepts safetensors-only Hugging Face revisions', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({
      sha: 'c'.repeat(40), siblings: [{ rfilename: 'model.safetensors', size: 1024 }, { rfilename: 'config.json', size: 128 }],
    }), { status: 200 })))
    const result = await inspectHuggingFaceRevision('org/model', 'c'.repeat(40))
    expect(result.totalBytes).toBe(1152)
  })
})
