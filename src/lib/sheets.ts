import { google } from "googleapis";
import { ReceiptData } from "./gemini";

function getAuth(accessToken: string) {
  const auth = new google.auth.OAuth2();
  auth.setCredentials({ access_token: accessToken });
  return auth;
}

// Create a new Google Sheet for this user with headers
export async function createSheet(accessToken: string, businessName: string): Promise<string> {
  const auth = getAuth(accessToken);
  const sheets = google.sheets({ version: "v4", auth });

  const response = await sheets.spreadsheets.create({
    requestBody: {
      properties: { title: `TaxBot - ${businessName}` },
      sheets: [
        {
          properties: { title: "รายการ" },
          data: [
            {
              startRow: 0,
              rowData: [
                {
                  values: [
                    { userEnteredValue: { stringValue: "วันที่" } },
                    { userEnteredValue: { stringValue: "ประเภท" } },
                    { userEnteredValue: { stringValue: "ร้านค้า/ผู้รับ" } },
                    { userEnteredValue: { stringValue: "จำนวนเงิน (฿)" } },
                    { userEnteredValue: { stringValue: "รายละเอียด" } },
                    { userEnteredValue: { stringValue: "บันทึกเมื่อ" } },
                  ],
                },
              ],
            },
          ],
        },
      ],
    },
  });

  return response.data.spreadsheetId!;
}

// Append one transaction row to the sheet
export async function appendTransaction(
  accessToken: string,
  sheetId: string,
  data: ReceiptData
): Promise<void> {
  const auth = getAuth(accessToken);
  const sheets = google.sheets({ version: "v4", auth });

  const typeLabel = data.type === "income" ? "รายรับ" : "รายจ่าย";
  const now = new Date().toLocaleString("th-TH", { timeZone: "Asia/Bangkok" });

  await sheets.spreadsheets.values.append({
    spreadsheetId: sheetId,
    range: "รายการ!A:F",
    valueInputOption: "USER_ENTERED",
    requestBody: {
      values: [[data.date, typeLabel, data.vendor, data.amount, data.description, now]],
    },
  });
}
