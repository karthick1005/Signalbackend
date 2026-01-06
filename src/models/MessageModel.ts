// models/Message.ts
import mongoose, { Document, Schema } from "mongoose";

export interface Message extends Document {
  messageId: string; // UUID from frontend
  text: string;
  encryptedContent: string; // For E2E encrypted messages
  sender: string;
  senderId: string;
  room: string;
  timestamp: Date;
  readBy: string[];
  reactions: { userId: string; emoji: string }[]; // Plain reactions for non-E2EE or metadata
  encryptedReactions: string[]; // Encrypted reactions array
}

const messageSchema = new Schema<Message>({
  messageId: { type: String, required: true, unique: true }, // UUID from frontend
  text: { type: String }, // Optional, for non-encrypted messages
  encryptedContent: { type: String }, // For E2E encrypted content
  sender: { type: String, required: true },
  senderId: { type: String, required: true },
  room: { type: String, required: true },
  timestamp: { type: Date, default: Date.now },
  readBy: [{ type: String, default: [] }], // Track which users have read this message
  reactions: [{ userId: String, emoji: String }],
  encryptedReactions: [{ type: String }],
});

// Add indexes for performance
messageSchema.index({ room: 1, timestamp: -1 });
messageSchema.index({ senderId: 1 });
messageSchema.index({ timestamp: -1 });

export const MessageModel = mongoose.model<Message>("Message", messageSchema);
