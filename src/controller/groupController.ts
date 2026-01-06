import { GroupModel } from "../models/GroupModel.js";
import { UserModel } from "../models/UserModel.js";
import { Request, Response } from "express";
import crypto from "crypto";

export const createGroup = async (req: Request, res: Response): Promise<void> => {
  const { name, members, adminId } = req.body;

  if (!name || !members || !adminId) {
    res.status(400).json({ error: "Missing required fields" });
    return;
  }

  // Check if admin exists
  const admin = await UserModel.findOne({ userId: adminId });
  if (!admin) {
    res.status(404).json({ error: "Admin not found" });
    return;
  }

  // Generate shared AES key for the group
  const groupKey = crypto.randomBytes(32).toString('base64'); // 256-bit key

  // Create group with shared key
  const group = new GroupModel({
    groupId: `group_${Date.now()}`,
    name,
    members: [adminId, ...members],
    admin: adminId,
    groupKey,
  });

  await group.save();
  res.status(201).json(group);
};

export const getGroups = async (req: Request, res: Response): Promise<void> => {
  const { userId } = req.params;
  const groups = await GroupModel.find({ members: userId });
  res.json(groups);
};
