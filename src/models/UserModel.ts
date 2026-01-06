import mongoose, { Document, Schema } from "mongoose";

export interface User extends Document {
  userId: string;
  username: string;
  registrationId: string;
  identityKey: string;
  signedPreKey: {
    keyId: string;
    publicKey: string;
    signature: string;
  };
  preKeys: {
    keyId: string;
    publicKey: string;
    used: boolean;
  }[];
  socketId: string | null;
  activeRooms: string[];
  lastActive: Date;
  isOnline: boolean;
  needsPreKeyUpload: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const userSchema = new Schema<User>({
  userId: { type: String, required: true, unique: true },
  username: { type: String, required: true },
  registrationId: String,
  identityKey: String,
  signedPreKey: {
    keyId: String,
    publicKey: String,
    signature: String,
  },
  preKeys: [
    {
      keyId: { type: String },
      publicKey: { type: String },
      used: { type: Boolean, default: false },
    },
  ],
  socketId: { type: String, default: null },
  activeRooms: [{ type: String, default: [] }],
  lastActive: { type: Date, default: Date.now },
  isOnline: { type: Boolean, default: false },
  needsPreKeyUpload: { type: Boolean, default: false },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
});

// Add indexes for performance
userSchema.index({ userId: 1 });
userSchema.index({ lastActive: -1 });
userSchema.index({ isOnline: 1 });

export const UserModel = mongoose.model<User>("User", userSchema);
