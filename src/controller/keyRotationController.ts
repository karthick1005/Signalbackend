import { UserModel } from "../models/UserModel.js";
import { Request, Response } from "express";

export const rotateKeys = async (req: Request, res: Response): Promise<void> => {
  const { userId } = req.body;

  if (!userId) {
    res.status(400).json({ error: "Missing userId" });
    return;
  }

  const user = await UserModel.findOne({ userId });
  if (!user) {
    res.status(404).json({ error: "User not found" });
    return;
  }

  // Here, we would generate new keys, but since it's client-side, perhaps notify client to rotate
  // For simplicity, mark as needing rotation
  user.needsPreKeyUpload = true;

  // Optionally, clear old prekeys
  user.preKeys = [];

  await user.save();

  // Notify user via socket if online
  if (user.socketId && req.app.get("io")) {
    req.app.get("io").to(user.socketId).emit("key:rotate");
  }

  res.json({ success: true, message: "Key rotation initiated" });
};
