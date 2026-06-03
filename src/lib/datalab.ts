/**
 * Datalab OCR integration
 * Docs: https://www.datalab.to/docs
 *
 * Flow (async):
 *  1. POST /api/v1/ocr  with image → { request_id }
 *  2. Poll GET /api/v1/ocr/{request_id} until status === "complete"
 *  3. Extract raw text from pages[]
 *  4. Parse structured receipt data with Groq
 *
 * NOTE: POST /api/v1/ocr is deprecated — migrate to new endpoint when available.
 */

const DATALAB_API_KEY = process.env.DATALAB_API_KEY ?? "";
const SUBMIT_URL      = "https://www.datalab.to/api/v1/ocr";
const POLL_URL        = (id: string) => `https://www.datalab.to/api/v1/ocr/${id}`;

const POLL_INTERVAL_MS = 2_000;
const POLL_TIMEOUT_MS  = 60_000;

// ── Submit image for OCR ────────────────────────────────────────────────────

async function submitOcr(base64Image: string): Promise<string> {
  // Convert base64 → Blob for multipart upload
  const byteString = atob(base64Image);
  const bytes = new Uint8Array(byteString.length);
  for (let i = 0; i < byteString.length; i++) bytes[i] = byteString.charCodeAt(i);
  const blob = new Blob([bytes], { type: "image/jpeg" });

  const form = new FormData();
  form.append("file", blob, "slip.jpg");
  // langs is deprecated but harmless; omit for default 'en'

  const res = await fetch(SUBMIT_URL, {
    method:  "POST",
    headers: { "X-Api-Key": DATALAB_API_KEY },
    body:    form,
  });

  if (!res.ok) {
    const err = await res.text().catch(() => String(res.status));
    throw new Error(`Datalab submit failed (${res.status}): ${err}`);
  }

  const data = await res.json();
  if (!data.request_id) throw new Error("Datalab: no request_id in response");
  return data.request_id as string;
}

// ── Poll until done ────────────────────────────────────────────────────────

interface DatalabPage {
  text_lines?: Array<{ text: string }>;
  text?:       string;
}

interface DatalabResult {
  status:     string;
  success:    boolean;
  error?:     string;
  pages?:     DatalabPage[];
}

async function pollResult(requestId: string): Promise<string> {
  const deadline = Date.now() + POLL_TIMEOUT_MS;

  while (Date.now() < deadline) {
    await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));

    const res = await fetch(POLL_URL(requestId), {
      headers: { "X-Api-Key": DATALAB_API_KEY },
    });

    if (!res.ok) continue; // transient error — keep polling

    const data: DatalabResult = await res.json();

    if (data.status === "complete" || data.status === "done") {
      if (!data.success) throw new Error(`Datalab OCR error: ${data.error ?? "unknown"}`);

      // Extract all text from pages
      const text = (data.pages ?? [])
        .map((p) => {
          if (p.text) return p.text;
          return (p.text_lines ?? []).map((l) => l.text).join("\n");
        })
        .join("\n\n")
        .trim();

      return text;
    }

    if (data.status === "error" || data.status === "failed") {
      throw new Error(`Datalab OCR failed: ${data.error ?? "unknown"}`);
    }
    // status === "processing" / "pending" → keep polling
  }

  throw new Error("Datalab OCR timeout after 60s");
}

// ── Parse text → structured receipt with Groq ──────────────────────────────

async function parseReceiptText(rawText: string, today: string) {
  const { readReceiptFromText } = await import("./groq");
  return readReceiptFromText(rawText, today);
}

// ── Public: readReceipt ────────────────────────────────────────────────────

export async function readReceipt(base64Image: string) {
  const today = new Date().toISOString().split("T")[0];

  const requestId = await submitOcr(base64Image);
  const rawText   = await pollResult(requestId);

  console.log("[datalab] OCR raw text:", rawText.slice(0, 300));

  return parseReceiptText(rawText, today);
}
