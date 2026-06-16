/**
 * Copyright 2026 熊高锐
 *
 * Licensed under the Apache License, Version 2.0
 */

/**
 * @file OpenAI Embedding Adapter
 * Uses text-embedding-3-small (1536d). Falls back to mock if no API key.
 */

import type { IEmbeddingService, EmbeddingResult } from "./types.js";

interface OpenAIEmbedResponse {
  data: { embedding: number[]; index: number }[];
  model: string;
}

export class OpenAIEmbeddingService implements IEmbeddingService {
  private apiKey: string;
  private model: string;
  private dimensions: number;

  constructor(opts?: { apiKey?: string; model?: string; dimensions?: number }) {
    this.apiKey = opts?.apiKey ?? process.env.OPENAI_API_KEY ?? "";
    this.model = opts?.model ?? "text-embedding-3-small";
    this.dimensions = opts?.dimensions ?? 512; // smaller = faster + cheaper
  }

  async embed(text: string): Promise<EmbeddingResult> {
    const results = await this.embedBatch([text]);
    return results[0];
  }

  async embedBatch(texts: string[]): Promise<EmbeddingResult[]> {
    if (!this.apiKey) {
      // Fallback to mock (deterministic hash-based vectors)
      return texts.map((t) => this.mockEmbed(t));
    }

    const response = await fetch("https://api.openai.com/v1/embeddings", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify({
        model: this.model,
        input: texts,
        dimensions: this.dimensions,
      }),
    });

    if (!response.ok) {
      const err = await response.text();
      throw new Error(`OpenAI Embedding API error ${response.status}: ${err.slice(0, 200)}`);
    }

    const body = (await response.json()) as OpenAIEmbedResponse;
    return body.data.map((d) => ({
      vector: d.embedding,
      dimensions: d.embedding.length,
      model: body.model,
    }));
  }

  similarity(a: number[], b: number[]): number {
    if (a.length !== b.length) {
      throw new Error(`Vector dimension mismatch: ${a.length} vs ${b.length}`);
    }
    let dot = 0, norma = 0, normb = 0;
    for (let i = 0; i < a.length; i++) {
      dot += a[i] * b[i];
      norma += a[i] * a[i];
      normb += b[i] * b[i];
    }
    if (norma === 0 || normb === 0) return 0;
    return dot / (Math.sqrt(norma) * Math.sqrt(normb));
  }

  /** Deterministic mock embedding using FNV-1a hash. Good for offline testing. */
  private mockEmbed(text: string): EmbeddingResult {
    const dim = this.dimensions;
    const vec: number[] = new Array(dim);
    // Seed-based pseudo-random: same text → same vector every time
    let h = 0x811c9dc5;
    for (let i = 0; i < text.length; i++) {
      h ^= text.charCodeAt(i);
      h = Math.imul(h, 0x01000193);
      h >>>= 0;
    }
    for (let i = 0; i < dim; i++) {
      h = Math.imul(h ^ (h >>> 16), 0x85ebca6b);
      h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35);
      h ^= h >>> 16;
      vec[i] = ((h >>> 0) % 1000) / 1000 - 0.5; // range: [-0.5, 0.5]
    }
    // Normalize
    let norm = 0;
    for (let i = 0; i < dim; i++) norm += vec[i] * vec[i];
    norm = Math.sqrt(norm);
    if (norm > 0) for (let i = 0; i < dim; i++) vec[i] /= norm;

    return { vector: vec, dimensions: dim, model: "mock-fnv1a" };
  }
}

/** Singleton. Initialize with API key or fall back to mock. */
let defaultService: IEmbeddingService | null = null;

export function getEmbeddingService(): IEmbeddingService {
  if (!defaultService) {
    defaultService = new OpenAIEmbeddingService();
  }
  return defaultService;
}

export function resetEmbeddingService(): void {
  defaultService = null;
}
