// Beam Checkout API client
// Docs: Basic Auth with API key as username, empty password

const BEAM_BASE = "https://api.beamcheckout.com/api/v1";

function getAuthHeader(): string {
  const merchantId = process.env.BEAM_MERCHANT_ID;
  const key        = process.env.BEAM_SECRET_KEY;
  if (!merchantId) throw new Error("BEAM_MERCHANT_ID is not set");
  if (!key)        throw new Error("BEAM_SECRET_KEY is not set");
  // Basic auth: base64("merchantId:apiKey")
  const encoded = Buffer.from(`${merchantId}:${key}`).toString("base64");
  return `Basic ${encoded}`;
}

export type BeamPaymentMethod = "QR_PROMPT_PAY";

export interface BeamCharge {
  chargeId?:      string;
  id?:            string;   // some gateways use "id" not "chargeId"
  status?:        string;
  amount?:        number;
  currency?:      string;
  referenceId?:   string;
  qrImage?:       string;
  qrData?:        string;
  qrCodeImage?:   string;
  qrCodeData?:    string;
  qrCodeUrl?:     string;
  paymentUrl?:    string;
  redirectUrl?:   string;
  createdAt?:     string;
  // allow any extra fields Beam returns
  [key: string]:  unknown;
}

export interface CreateChargeParams {
  amount:      number;   // in satang
  referenceId: string;
  returnUrl:   string;
  expiryTime?: string;   // ISO8601 — defaults to 15 min from now
}

/** Create a PromptPay QR charge */
export async function createCharge(params: CreateChargeParams): Promise<BeamCharge> {
  const expiryTime =
    params.expiryTime ??
    new Date(Date.now() + 5 * 60 * 1000).toISOString();

  const body = {
    amount:      params.amount,
    currency:    "THB",
    paymentMethod: {
      qrPromptPay: { expiryTime },
      paymentMethodType: "QR_PROMPT_PAY",
    },
    referenceId: params.referenceId,
    returnUrl:   params.returnUrl,
    skip3dsFlow: false,
  };

  const res = await fetch(`${BEAM_BASE}/charges`, {
    method:  "POST",
    headers: {
      "Authorization": getAuthHeader(),
      "Content-Type":  "application/json",
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Beam createCharge failed (${res.status}): ${err.slice(0, 300)}`);
  }

  return res.json();
}

// ── Payment Links (hosted checkout: card + QR in one page) ──────────────
// Docs: POST /api/v1/payment-links → { id, url }.  The buyer is redirected to
// `url` (Beam-hosted), picks card or PromptPay there, and is sent back to
// redirectUrl on success. No card data ever touches our servers (no PCI scope).

export interface CreatePaymentLinkParams {
  amount:      number;   // in satang
  referenceId: string;
  redirectUrl: string;
  description?: string;
}

export interface BeamPaymentLink {
  id?:            string;
  paymentLinkId?: string;   // GET response uses this name
  url?:           string;
  status?:        string;   // ACTIVE | PAID | EXPIRED | DISABLED | VOIDED | REFUNDED
  [key: string]:  unknown;
}

/** Create a hosted payment link that offers credit/debit card + PromptPay QR */
export async function createPaymentLink(params: CreatePaymentLinkParams): Promise<BeamPaymentLink> {
  const body = {
    order: {
      currency:    "THB",
      netAmount:   params.amount,           // satang, min 100
      referenceId: params.referenceId,
      description: params.description ?? "Vendee subscription",
    },
    linkSettings: {
      card:        { isEnabled: true },
      qrPromptPay: { isEnabled: true },
    },
    collectPhoneNumber: false,
    redirectUrl: params.redirectUrl,
  };

  const res = await fetch(`${BEAM_BASE}/payment-links`, {
    method:  "POST",
    headers: {
      "Authorization": getAuthHeader(),
      "Content-Type":  "application/json",
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Beam createPaymentLink failed (${res.status}): ${err.slice(0, 300)}`);
  }

  return res.json();
}

/** Get payment link status (PAID means the buyer completed payment) */
export async function getPaymentLink(paymentLinkId: string): Promise<BeamPaymentLink> {
  const res = await fetch(`${BEAM_BASE}/payment-links/${paymentLinkId}`, {
    headers: { "Authorization": getAuthHeader() },
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Beam getPaymentLink failed (${res.status}): ${err.slice(0, 300)}`);
  }

  const data = await res.json();
  console.log("[beam] getPaymentLink response:", JSON.stringify(data).slice(0, 300));
  return data;
}

/** Get charge status */
export async function getCharge(chargeId: string): Promise<BeamCharge> {
  const res = await fetch(`${BEAM_BASE}/charges/${chargeId}`, {
    headers: { "Authorization": getAuthHeader() },
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Beam getCharge failed (${res.status}): ${err.slice(0, 300)}`);
  }

  const data = await res.json();
  console.log("[beam] getCharge response:", JSON.stringify(data).slice(0, 300));
  return data;
}

/** Plan definitions */
export const PLANS = {
  eco:      { name: "Eco",      amount: 10000,  thb: 100  },
  pro:      { name: "Pro",      amount: 20000,  thb: 200  },
  platinum: { name: "Platinum", amount: 70000,  thb: 700  },
} as const;

export type PlanKey = keyof typeof PLANS;
