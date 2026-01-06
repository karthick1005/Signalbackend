import { Request, Response, NextFunction } from "express";
import connectToDatabase from "../lib/db.js";
import { UserModel } from "../models/UserModel.js";
import { v4 as uuidv4 } from "uuid";
import { getIO } from "../socket/socket.js";
import activeUsersById from "../socket/activeUsers.js";
import mongoose from "mongoose";
import jwt from "jsonwebtoken";

// export const createUser = async (
//   req: Request,
//   res: Response,
//   next: NextFunction
// ): Promise<Response> => {
//   try {
//     await connectToDatabase();

//     const { username, registrationId, identityKey, signedPreKey, preKey } = req.body;

//     // Validate required fields
//     if (!username || !registrationId || !identityKey || !signedPreKey || !preKey) {
//       return res.status(400).json({ error: "Missing required fields" });
//     }

//     // Check if user exists
//     let user = await UserModel.findOne({ username });

//     if (user) {
//       // Update existing user WITHOUT changing userId
//       user.registrationId = registrationId;
//       user.identityKey = identityKey;
//       user.signedPreKey = {
//         keyId: signedPreKey.keyId,
//         publicKey: signedPreKey.publicKey,
//         signature: signedPreKey.signature,
//       };
//       user.preKey = {
//         keyId: preKey.keyId,
//         publicKey: preKey.publicKey,
//       };

//       await user.save();
//       return res.status(200).json(user);
//     } else {
//       // Create a new user with new userId
//       user = new UserModel({
//         userId: uuidv4(),
//         username,
//         registrationId,
//         identityKey,
//         signedPreKey: {
//           keyId: signedPreKey.keyId,
//           publicKey: signedPreKey.publicKey,
//           signature: signedPreKey.signature,
//         },
//         preKey: {
//           keyId: preKey.keyId,
//           publicKey: preKey.publicKey,
//         },
//       });

//       await user.save();
//       return res.status(201).json(user);
//     }
//   } catch (error) {
//     console.error("Error creating/updating user:", error);
//     return res.status(500).json({ error: "Something went wrong" });
//   }
// };
export const createUser = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<Response> => {
  try {
    await connectToDatabase();

    const { username, registrationId, identityKey, signedPreKey, preKeys } = req.body;

    // Validate required fields
    if (!username || !registrationId || !identityKey || !signedPreKey || !preKeys || !Array.isArray(preKeys)) {
      return res.status(400).json({ error: "Missing or invalid required fields" });
    }

    let user = await UserModel.findOne({ username });

    if (user) {
      // Update existing user (without changing userId)
      user.registrationId = registrationId;
      user.identityKey = identityKey;
      user.signedPreKey = {
        keyId: signedPreKey.keyId,
        publicKey: signedPreKey.publicKey,
        signature: signedPreKey.signature,
      };
      user.preKeys = preKeys; // ⚠️ Replacing old preKeys completely

      await user.save();
      const token = jwt.sign({ userId: user.userId, username: user.username }, process.env.JWT_SECRET || "secret", { expiresIn: "7d" });
      return res.status(200).json({ user, token });
    } else {
      // Create a new user
      user = new UserModel({
        userId: uuidv4(),
        username,
        registrationId,
        identityKey,
        signedPreKey: {
          keyId: signedPreKey.keyId,
          publicKey: signedPreKey.publicKey,
          signature: signedPreKey.signature,
        },
        preKeys, // ⬅️ save array directly
      });

      await user.save();
      const token = jwt.sign({ userId: user.userId, username: user.username }, process.env.JWT_SECRET || "secret", { expiresIn: "7d" });
      return res.status(201).json({ user, token });
    }
  } catch (error) {
    console.error("Error creating/updating user:", error);
    return res.status(500).json({ error: "Something went wrong" });
  }
};
export const getAllUsers = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<Response> => {
  try {
    await connectToDatabase();
    const users = await UserModel.find({}, { username: 1, userId: 1, image: 1 });
    return res.json(users);
  } catch (error) {
    console.error("Error fetching users:", error);
    return res.status(500).json({ error: "Something went wrong" });
  }
};
export const getUser = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<Response> => {
    await connectToDatabase();
    const { userId } = req.body;
    const user = await UserModel.findOne({ userId })
     if (!user) {
      return res.status(404).json({ error: "User not found" });
    }
    return res.json(user);
  }
    
// export const getUserDetails = async (
//   req: Request,
//   res: Response,
//   next: NextFunction
// ): Promise<Response> => {
//   try {
//     await connectToDatabase();
//     const { userId } = req.body;

//     const user = await UserModel.findOne({ userId });
//     if (!user) {
//       return res.status(404).json({ error: "User not found" });
//     }

//     if (!user.preKeys || user.preKeys.length === 0) {
//       return res.status(400).json({ error: "No available preKeys" });
//     }

//     // Select the first available preKey
//     const selectedPreKey = user.preKeys[0];

//     // Remove it from the user's preKey array
//     user.preKeys.splice(0, 1); // Remove first preKey
//     await user.save();
//     if(user.preKeys.length < 10) {
//       const io = getIO();
//      const socketId = activeUsersById.get(userId);
//     if (socketId) {
//     io.to(socketId).emit("generate_prekey", {
//       type:"prekey"
//     });
//     console.log(`✅ Sent notification to user ${userId}`);
//   } else {
//     console.log(`❌ User ${userId} is offline`);
//     // Optionally store notification for later
//   }
//     }
//     return res.json({
//       userId: user.userId,
//       username: user.username,
//       registrationId: user.registrationId,
//       identityKey: user.identityKey,
//       signedPreKey: user.signedPreKey,
//       preKey: selectedPreKey, // Only ONE preKey
//     });
//   } catch (error) {
//     console.error("Error getting user details:", error);
//     return res.status(500).json({ error: "Something went wrong" });
//   }
// };
export const getUserDetails = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<Response> => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    await connectToDatabase();
    const { userId } = req.body;

    const user = await UserModel.findOne({ userId }).session(session);
    if (!user) {
      await session.abortTransaction();
      return res.status(404).json({ error: "User not found" });
    }

    if (!user.preKeys || user.preKeys.length === 0) {
      await session.abortTransaction();
      return res.status(400).json({ error: "No available preKeys" });
    }

    // ✅ Select and remove first available preKey
    const selectedPreKey = user.preKeys[0];
    user.preKeys.splice(0, 1);
    await user.save({ session });

    // ✅ Commit transaction
    await session.commitTransaction();
    session.endSession();

    // 🔔 Emit "generate_prekey" if needed
    if (user.preKeys.length < 10) {
      const io = getIO();
      const socketId = activeUsersById.get(userId);
      if (socketId) {
        io.to(socketId).emit("generate_prekey", { type: "prekey" });
        console.log(`✅ Sent notification to user ${userId}`);
      } else {
        console.log(`❌ User ${userId} is offline`);
      }
    }

    return res.json({
      userId: user.userId,
      username: user.username,
      registrationId: user.registrationId,
      identityKey: user.identityKey,
      signedPreKey: user.signedPreKey,
      preKey: selectedPreKey, // ✅ Only send the removed one
    });

  } catch (error) {
    await session.abortTransaction();
    session.endSession();
    console.error("Error getting user details:", error);
    return res.status(500).json({ error: "Something went wrong" });
  }
};

