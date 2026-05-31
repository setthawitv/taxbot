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
