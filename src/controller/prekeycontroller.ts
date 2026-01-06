import { UserModel } from "../models/UserModel.js";
import { Request, Response } from "express";
export const uploadPrekeys = async (req: Request, res: Response): Promise<Response> => {
  const { userId, preKeys } = req.body;

  if (!userId || !Array.isArray(preKeys)) {
    return res.status(400).json({ error: "Missing userId or preKeys" });
  }

  const user = await UserModel.findOne({ userId });
  if (!user) return res.status(404).json({ error: "User not found" });

  // Append new preKeys
  for (const key of preKeys) {
    if (key.keyId && key.publicKey) {
      user.preKeys.push({ keyId: key.keyId, publicKey: key.publicKey, used: false });
    }
  }

  user.needsPreKeyUpload = false;
  await user.save();

  return res.json({ success: true, message: "PreKeys uploaded successfully" });
};

export const requestPrekey = async (req: Request, res: Response): Promise<Response> => {
  const { userId } = req.body;

  const user = await UserModel.findOne({ userId });
  if (!user) return res.status(404).json({ error: "User not found" });

  // Find an unused preKey
  const preKey = user.preKeys.find((key) => !key.used);
  if (!preKey) return res.status(400).json({ error: "No available preKeys" });

  // Mark it as used
  preKey.used = true;

  // Check how many unused are left
  const unusedCount = user.preKeys.filter(k => !k.used).length;
  if (unusedCount < 10) {
    user.needsPreKeyUpload = true;
    // Optionally emit socket event here if socketId exists
    if (user.socketId && req.app.get("io")) {
      req.app.get("io").to(user.socketId).emit("prekey:uploadMore");
    }
  }

  await user.save();

  return res.json({
    identityKey: user.identityKey,
    registrationId: user.registrationId,
    signedPreKey: user.signedPreKey,
    preKey,
  });
};
