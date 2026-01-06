import mongoose, { Document, Schema } from "mongoose";

export interface Group extends Document {
  groupId: string;
  name: string;
  members: string[]; // userIds
  admin: string; // userId
  groupKey: string; // Encrypted group key
  createdAt: Date;
}

const groupSchema = new Schema<Group>({
  groupId: { type: String, required: true, unique: true },
  name: { type: String, required: true },
  members: [{ type: String }],
  admin: { type: String, required: true },
  groupKey: { type: String, required: true },
  createdAt: { type: Date, default: Date.now },
});

export const GroupModel = mongoose.model<Group>("Group", groupSchema);
