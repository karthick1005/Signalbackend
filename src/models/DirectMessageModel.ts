// models/DirectMessageModel.ts
import mongoose, { Document, Schema } from "mongoose";

export interface DirectMessage extends Document {
  senderId: string;
  receiverId: string;
  senderName: string;
  encryptedMessage: Object;
  timestamp: Date;
  delivered: boolean;
}

const directMessageSchema = new Schema<DirectMessage>({
  senderId: { type: String, required: true },
   senderName: { type: String, required: true },
  receiverId: { type: String, required: true },
  encryptedMessage: { type: Object, required: true },
  timestamp: { type: Date, default: Date.now },
  delivered: { type: Boolean, default: false },
});

directMessageSchema.index({ receiverId: 1, delivered: 1 }); // Index for efficient undelivered message queries

export const DirectMessageModel = mongoose.model<DirectMessage>("DirectMessage", directMessageSchema);
