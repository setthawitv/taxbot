import { google } from "googleapis";
import { Readable } from "stream";

const THAI_MONTHS = [
  "01_มกราคม", "02_กุมภาพันธ์", "03_มีนาคม", "04_เมษายน",
  "05_พฤษภาคม", "06_มิถุนายน", "07_กรกฎาคม", "08_สิงหาคม",
  "09_กันยายน", "10_ตุลาคม", "11_พฤศจิกายน", "12_ธันวาคม",
];

function getDriveClient(accessToken: string) {
  const auth = new google.auth.OAuth2();
  auth.setCredentials({ access_token: accessToken });
  return google.drive({ version: "v3", auth });
}

/** Find a folder by name under parentId, or create it if missing. */
async function findOrCreateFolder(
  drive: ReturnType<typeof google.drive>,
  parentId: string,
  name: string
): Promise<string> {
  const safe = name.replace(/'/g, "\\'");
  const res = await drive.files.list({
    q: `name='${safe}' and '${parentId}' in parents and mimeType='application/vnd.google-apps.folder' and trashed=false`,
    fields: "files(id)",
    spaces: "drive",
  });

  if (res.data.files?.length) return res.data.files[0].id!;

  const created = await drive.files.create({
    requestBody: {
      name,
      mimeType: "application/vnd.google-apps.folder",
      parents: [parentId],
    },
    fields: "id",
  });

  return created.data.id!;
}

/**
 * Create the root Vendee Finance folder for a user on first onboarding.
 * Returns the folder ID to store in users.drive_folder_id.
 */
export async function createRootFolder(
  accessToken: string,
  businessName: string
): Promise<string> {
  const drive = getDriveClient(accessToken);
  const taxbotId = await findOrCreateFolder(drive, "root", "Vendee Finance");
  return findOrCreateFolder(drive, taxbotId, businessName);
}

/**
 * Ensure the full receipt folder path exists and return the leaf folder ID,
 * the accounting folder ID, and the transaction folder URL.
 *
 * Path:
 *   rootFolder / YYYY / MM_monthThai / รวมหลักฐาน   / YYYY-MM-DD_vendor  ← evidence
 *   rootFolder / YYYY / MM_monthThai / สำหรับสำนักงานบัญชี               ← accounting PDFs
 */
export async function ensureReceiptFolder(
  accessToken: string,
  rootFolderId: string,
  date: string,   // YYYY-MM-DD
  vendor: string
): Promise<{ folderId: string; folderUrl: string; accountingFolderId: string }> {
  const drive = getDriveClient(accessToken);

  const [year, monthStr] = date.split("-");
  const monthFolder = THAI_MONTHS[parseInt(monthStr, 10) - 1];

  const yearId  = await findOrCreateFolder(drive, rootFolderId, year);
  const monthId = await findOrCreateFolder(drive, yearId, monthFolder);

  // Create both subfolders at the month level in parallel
  const [accountingFolderId, evidenceId] = await Promise.all([
    findOrCreateFolder(drive, monthId, "สำหรับสำนักงานบัญชี"),
    findOrCreateFolder(drive, monthId, "รวมหลักฐาน"),
  ]);

  // Transaction folder — sanitise vendor name for file-system safety
  const safeName = `${date}_${vendor.replace(/[/\\:*?"<>|]/g, "").trim().slice(0, 40)}`;
  const txFolderId = await findOrCreateFolder(drive, evidenceId, safeName);

  return {
    folderId: txFolderId,
    folderUrl: `https://drive.google.com/drive/folders/${txFolderId}`,
    accountingFolderId,
  };
}

/**
 * Upload a file (image, PDF, …) into a Drive folder.
 * Returns the webViewLink.
 */
export async function uploadFileToDrive(
  accessToken: string,
  folderId: string,
  fileName: string,
  content: Buffer,
  mimeType: string
): Promise<string> {
  const drive = getDriveClient(accessToken);

  const res = await drive.files.create({
    requestBody: { name: fileName, parents: [folderId] },
    media: { mimeType, body: Readable.from(content) },
    fields: "id,webViewLink",
  });

  return (
    res.data.webViewLink ?? `https://drive.google.com/file/d/${res.data.id}/view`
  );
}
