// models/Room.ts
import mongoose, { Document, Schema } from "mongoose";

interface Participant {
  userId: string;
  username: string;
}

export interface Room extends Document {
  name: string;
  participants: Participant[];
  isPrivate: boolean;
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
}

const roomSchema = new Schema<Room>({
  name: { type: String, required: true, unique: true },
  participants: [{
    userId: { type: String, required: true },
    username: { type: String, required: true }
  }],
  isPrivate: { type: Boolean, default: false },
  createdBy: { type: String, required: true },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

export const RoomModel = mongoose.model<Room>("Room", roomSchema);
