// models/ChatRelationship.ts

import mongoose from "mongoose";

const ChatRelationshipSchema = new mongoose.Schema({
  users: {
    type: [String], // always [userA, userB]
    required: true,
    validate: (v: string | any[]) => v.length === 2,
  },
  lastInteraction: {
    type: Date,
    default: Date.now,
  },
});

ChatRelationshipSchema.index({ users: 1 }, { unique: true });

export const ChatRelationshipModel = mongoose.model(
  "ChatRelationship",
  ChatRelationshipSchema
);
