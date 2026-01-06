import { Request, Response } from "express";
import { bucket } from "../lib/firebase-admin.js";
import { v4 as uuidv4 } from "uuid";
import { Readable } from "stream";

export const uploadmedia = async (req: Request, res: Response): Promise<void> => {
  try {
    const file = req.file;

    if (!file) {
      res.status(400).json({ error: "No file uploaded" });
      return;
    }

    const downloadToken = process.env.TOKEN
    const filename = `chat_attachments/${uuidv4()}_${file.originalname}`;
    const blob = bucket.file(filename);

    // Upload the file with metadata
    await new Promise<void>((resolve, reject) => {
      const blobStream = blob.createWriteStream({
        metadata: {
          contentType: "application/octet-stream",
          metadata: {
            firebaseStorageDownloadTokens: downloadToken, // ✅ Public access via token
          },
        },
      });

      blobStream.on("error", reject);
      blobStream.on("finish", resolve);
      blobStream.end(file.buffer);
    });

    // 🔗 Firebase-style public URL
    const publicUrl = `https://firebasestorage.googleapis.com/v0/b/${bucket.name}/o/${encodeURIComponent(
      filename
    )}?alt=media`;

    res.status(200).json({
      url: publicUrl,
      name: file.originalname,
    });
  } catch (error) {
    console.error("Upload error:", error);
    res.status(500).json({ error: "Upload failed" });
  }
};

// Proxy endpoint to fetch file from Firebase
export const proxyFirebaseFile = async (req: Request, res: Response) => {
  try {
    let { url } = req.query;

    if (!url || typeof url !== "string") {
      res.status(400).json({ error: "Missing or invalid 'url' parameter" });
      return;
    }
    url=url+ `&token=${process.env.TOKEN}`; // Append token for public access
    console.log("Proxying file from URL:", url);
    const response = await fetch(url); // Node.js fetch (>= v18)
    console.log("Fetching file from:", url);
    if (!response.ok) {
      throw new Error(`Failed to fetch file: ${response.statusText}`);
    }
    console.log("File fetched successfully",response);
    // Pipe headers
    res.setHeader("Content-Type", response.headers.get("Content-Type") || "application/octet-stream");

    // Stream file content directly to client
   const nodeStream = Readable.fromWeb(response.body as any);
nodeStream.pipe(res); 
  } catch (error) {
    console.error("Proxy fetch error:", error);
    res.status(500).json({ error: "Failed to fetch and stream file" });
  }
};
