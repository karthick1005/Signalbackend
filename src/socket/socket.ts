// socket/socket.ts
import { Server as HttpServer } from "http";
import { Server, Socket } from "socket.io";
import { createAdapter } from "@socket.io/redis-adapter";
import { createClient } from "redis";
import mongoose from "mongoose";
import { UserModel } from "../models/UserModel.js";
import { RoomModel } from "../models/RoomModel.js";
import { MessageModel } from "../models/MessageModel.js";
import { DirectMessageModel } from "../models/DirectMessageModel.js";
import { ChatRelationshipModel } from "../models/ChatRelationship.js";
import { GroupModel } from "../models/GroupModel.js";
import activeUsersById from "./activeUsers.js";

interface UserData {
  userId: string;
  username: string;
}

interface DirectMessageData {
  encryptedMessage: any;
  receiverId?: string;
  senderId:string
  senderName?: string;
}
interface AcknowledgeData{
  messageId: string;
   receiverId?: string;
  senderId:string;
  status: string; // e.g., "delivered", "read"
}
interface ReactionData {
  messageId: string;
  encryptedReaction: string;
  senderId: string;
  room: string; // groupId or direct chatId
}

async function updateChatRelationship(sender: string, receiver: string) {
  const users = [sender, receiver].sort(); // consistent ordering

  await ChatRelationshipModel.findOneAndUpdate(
    { users },
    { $set: { lastInteraction: new Date() } },
    { upsert: true }
  );
}
let io: Server;
export const initializeSocket = (server: HttpServer) => {
  io = new Server(server, {
    cors: {
      origin: ["http://localhost:3000", "http://localhost:8000"],
      methods: ["GET", "POST"],
      credentials: true
    },
    path: "/websocket",
  });

  // Try to connect to Redis for clustering; fall back if unavailable
  (async () => {
    try {
      const pubClient = createClient({ url: "redis://localhost:6379" });
      const subClient = pubClient.duplicate();
      await pubClient.connect();
      await subClient.connect();
      io.adapter(createAdapter(pubClient, subClient));
      console.log("Socket.io initialized with Redis adapter");
    } catch (error) {
      console.warn("Redis not available, running without clustering:", error instanceof Error ? error.message : JSON.stringify(error));
      console.log("Socket.io initialized without Redis");
    }
  })();
  // Map userId to socketId for direct messaging
  // Map socketId to user data for easy cleanup
  const users = new Map<string, UserData>();

  io.on("connection", (socket: Socket) => {
    console.log(`User connected: ${socket.id}`);

    // When user authenticates / connects and provides userId & username
    socket.on("user_connected", async (userData: UserData) => {
      const { userId, username } = userData;

      // Track user in memory
      users.set(socket.id, { userId, username });
      console.log(`User data stored: ${username} (${userId})`);
      activeUsersById.set(userId, socket.id);

      // Update user status in DB (optional)
      await UserModel.findOneAndUpdate(
        { userId },
        { socketId: socket.id, isOnline: true, lastActive: new Date() },
        { upsert: true }
      );

      // Join user to their groups (WhatsApp-style: groups exist only locally)
      // We'll handle group joining when client announces their groups
      console.log(`User logged in: ${username} (${userId}) - waiting for group announcements`);

      // Send any undelivered direct messages
      const undeliveredMessages = await DirectMessageModel.find({
        receiverId: userId,
        delivered: false,
      });

      for (const msg of undeliveredMessages) {
        socket.emit("direct_message", {
          senderId: msg.senderId,
          encryptedMessage: msg.encryptedMessage,
          timestamp: msg.timestamp,
          senderName: msg.senderName,
        });
      }

      // Mark messages as delivered
      await DirectMessageModel.deleteMany(
        { receiverId: userId, delivered: false },
      );
    });
    socket.on("acknowledge_message", async (data: AcknowledgeData) => {
      const { messageId,senderId,receiverId,status } = data;
       const sender = users.get(socket.id);
        if (!sender || sender.userId !== senderId) {
        socket.emit("error", { message: "Invalid sender or not authenticated" });
        return;
      }
   // Find receiver's socket
      if (typeof receiverId === "string") {
        console.log("this is acknwledge message", data);
        const receiverSocketId = activeUsersById.get(receiverId);
        console.log("Receiver socket ID:", receiverSocketId);
        // updateChatRelationship(senderId.toString(),receiverId)
        if (receiverSocketId) {
          console.log("this is user online", receiverId);
          // Receiver online - send message immediately
          io.to(receiverSocketId).emit("acknowledge_message", {
            senderId: senderId,
            messageId: messageId,
            status: status,
            timestamp: new Date().toISOString(),
          });
        } else {
          console.log("this is user offline", receiverId);
          // Receiver offline - save message for later
          // const newMsg = new DirectMessageModel({
          //   senderId,
          //   receiverId,
          //   encryptedMessage,
          //   //  senderName,
          //   timestamp: new Date(),
          //   delivered: false,
          // });
          // await newMsg.save();
        }
      } else {
        socket.emit("error", { message: "Invalid receiverId" });
      }
    });

    // Handle WhatsApp-style group announcements from clients
    socket.on("announce_groups", (data: { groups: Array<{ groupId: string; name: string }> }) => {
      const sender = users.get(socket.id);
      if (!sender) {
        socket.emit("error", { message: "Not authenticated" });
        return;
      }

      console.log(`📢 User ${sender.username} announcing ${data.groups.length} groups`);
      
      // Join user to all their group rooms
      for (const group of data.groups) {
        socket.join(group.groupId);
        console.log(`👥 ${sender.username} joined room: ${group.groupId} (${group.name})`);
      }

      console.log(`✅ ${sender.username} joined ${data.groups.length} group rooms`);
    });

    // Handle sending direct messages
    socket.on("direct_message", async (data: DirectMessageData) => {

      console.log("Received direct message:", data);
      const { senderId, receiverId, encryptedMessage,senderName } = data;

      const sender = users.get(socket.id);
      if (!sender || sender.userId !== senderId) {
        socket.emit("error", { message: "Invalid sender or not authenticated" });
        return;
      }
      
      // Find receiver's socket
      if (typeof receiverId === "string") {
        const receiverSocketId = activeUsersById.get(receiverId);
        console.log("Receiver socket ID:", receiverSocketId);
        // updateChatRelationship(senderId.toString(),receiverId)
        if (receiverSocketId) {
          console.log("this is user online", receiverId);
          // Receiver online - send message immediately
          io.to(receiverSocketId).emit("direct_message", {
            senderId: senderId,
            encryptedMessage,
           senderName,
            timestamp: new Date().toISOString(),
          });
        } else {
          console.log("this is user offline", receiverId);
          // Receiver offline - save message for later
          const newMsg = new DirectMessageModel({
            senderId,
            receiverId,
            encryptedMessage,
             senderName,
            timestamp: new Date(),
            delivered: false,
          });
          await newMsg.save();
        }
      } else {
        socket.emit("error", { message: "Invalid receiverId" });
      }
    });

    // Handle sending WhatsApp-style group messages
    socket.on("group_message", async (data: {
      encryptedMessage: any;
      senderId: string;
      senderName: string;
      room: string;
      messageId: string;
      timestamp: number;
    }) => {
      const { senderId, senderName, encryptedMessage, room, messageId, timestamp } = data;
      
      console.log(`📤 WhatsApp-style group message received:`, {
        senderId,
        senderName,
        room,
        messageId: messageId.substring(0, 8) + '...'
      });

      const sender = users.get(socket.id);
      if (!sender || sender.userId !== senderId) {
        console.error("❌ Invalid sender or not authenticated");
        socket.emit("error", { message: "Invalid sender or not authenticated" });
        return;
      }

      // Save the encrypted message to DB (WhatsApp doesn't decrypt on server)
      const message = new MessageModel({
        messageId,
        text: "[Encrypted Group Message]", // Server doesn't see plaintext
        encryptedContent: JSON.stringify(encryptedMessage),
        sender: sender.username,
        senderId,
        room,
        timestamp: new Date(timestamp),
      });
      await message.save();
      console.log(`💾 Encrypted group message saved to DB`);

      // Forward encrypted message to all group members (WhatsApp-style)
      socket.to(room).emit("group_message", {
        encryptedMessage,
        senderId,
        senderName: sender.username,
        room,
        messageId,
        timestamp
      });
      
      console.log(`📡 WhatsApp-style group message forwarded to room: ${room}`);
    });

    // Handle deleting messages
    socket.on("delete_message", async (data: { messageId: string; room: string }) => {
      const { messageId, room } = data;

      const sender = users.get(socket.id);
      if (!sender) {
        socket.emit("error", { message: "Not authenticated" });
        return;
      }

      // Find and delete the message
      const message = await MessageModel.findOne({ messageId });
      if (!message) {
        socket.emit("error", { message: "Message not found" });
        return;
      }

      // Check if sender is the owner
      if (message.senderId !== sender.userId) {
        socket.emit("error", { message: "Not authorized to delete this message" });
        return;
      }

      await MessageModel.findOneAndDelete({ messageId });

      // Emit to all in the room
      if (room.startsWith("group_")) {
        io.to(room).emit("message_deleted", { messageId });
      } else {
        // For direct, emit to the receiver
        const receiverId = room;
        const receiverSocketId = activeUsersById.get(receiverId);
        if (receiverSocketId) {
          io.to(receiverSocketId).emit("message_deleted", { messageId });
        }
      }
    });

    // Handle sending reactions
    socket.on("send_reaction", async (data: ReactionData) => {
      const { messageId, encryptedReaction, senderId, room } = data;

      const sender = users.get(socket.id);
      if (!sender || sender.userId !== senderId) {
        socket.emit("error", { message: "Invalid sender or not authenticated" });
        return;
      }

      // Find the message and add the encrypted reaction
      const message = await MessageModel.findOne({ messageId });
      if (!message) {
        socket.emit("error", { message: "Message not found" });
        return;
      }

      // Add the encrypted reaction to the message
      message.encryptedReactions.push(encryptedReaction);
      await message.save();

      // Emit to all users in the room (for groups) or to the receiver (for direct)
      if (room.startsWith("group_")) {
        // Group message
        io.to(room).emit("new_reaction", {
          messageId,
          encryptedReaction,
          senderId,
          room,
        });
      } else {
        // Direct message, find receiver
        const receiverId = room; // Assuming room is receiverId for direct
        const receiverSocketId = activeUsersById.get(receiverId);
        if (receiverSocketId) {
          io.to(receiverSocketId).emit("new_reaction", {
            messageId,
            encryptedReaction,
            senderId,
            room,
          });
        }
      }
    });

    socket.on("direct_call",async (data)=>{

      console.log("Received direct message:", data);
      const { senderId, receiverId, encryptedMessage,senderName } = data;

      const sender = users.get(socket.id);
      if (!sender || sender.userId !== senderId) {
        socket.emit("error", { message: "Invalid sender or not authenticated" });
        return;
      }
      
      // Find receiver's socket
      if (typeof receiverId === "string") {
        const receiverSocketId = activeUsersById.get(receiverId);
        console.log("Receiver socket ID:", receiverSocketId);
        // updateChatRelationship(senderId.toString(),receiverId)
        if (receiverSocketId) {
          console.log("this is user online", receiverId);
          // Receiver online - send message immediately
          io.to(receiverSocketId).emit("direct_call", {
            senderId: senderId,
            encryptedMessage,
           senderName,
            timestamp: new Date().toISOString(),
          });
        } else {
         
        }
      } else {
        socket.emit("error", { message: "Invalid receiverId" });
      }
    });

    // WhatsApp-style Group Management Events (Peer-to-Peer)
    socket.on("group_created", async (data) => {
      try {
        console.log("📢 Group creation announcement:", data);
        
        // Announce group creation to all invited members
        if (data.groupMetadata && data.groupMetadata.members) {
          for (const member of data.groupMetadata.members) {
            const memberSocketId = activeUsersById.get(member.userId);
            if (memberSocketId && memberSocketId !== socket.id) {
              io.to(memberSocketId).emit("group_invitation", {
                groupMetadata: data.groupMetadata,
                invitedBy: data.groupMetadata.createdBy,
                timestamp: data.timestamp
              });
              console.log(`📨 Group invitation sent to ${member.userId}`);
            }
          }
        }
      } catch (error) {
        console.error("Error handling group creation:", error);
        socket.emit("error", { message: "Failed to announce group creation" });
      }
    });

    socket.on("group_invitation", async (data) => {
      try {
        console.log("📨 Group invitation:", data);
        
        // Forward invitation to specific user
        const targetSocketId = activeUsersById.get(data.targetUserId);
        if (targetSocketId) {
          io.to(targetSocketId).emit("group_invitation", {
            groupMetadata: data.groupMetadata,
            invitedBy: users.get(socket.id)?.userId,
            timestamp: data.timestamp
          });
          console.log(`📨 Group invitation forwarded to ${data.targetUserId}`);
        } else {
          console.log(`📱 User ${data.targetUserId} offline - invitation queued`);
          // In a real implementation, you'd queue this invitation
        }
      } catch (error) {
        console.error("Error handling group invitation:", error);
      }
    });

    socket.on("group_metadata_update", async (data) => {
      try {
        console.log("📥 Group metadata update:", data);
        
        // Forward metadata update to all group members
        if (data.metadata && data.metadata.members) {
          const senderUserId = users.get(socket.id)?.userId;
          
          for (const member of data.metadata.members) {
            const memberSocketId = activeUsersById.get(member.userId);
            if (memberSocketId && memberSocketId !== socket.id) {
              io.to(memberSocketId).emit("group_metadata_update", {
                groupId: data.groupId,
                metadata: data.metadata,
                action: data.action,
                details: data.details,
                fromMember: senderUserId,
                timestamp: data.timestamp
              });
            }
          }
          console.log(`📢 Group metadata update propagated for ${data.groupId}`);
        }
      } catch (error) {
        console.error("Error handling group metadata update:", error);
      }
    });

    socket.on("group_member_joined", async (data) => {
      try {
        console.log("👥 Group member joined:", data);
        
        // This could be used to notify other members
        // For now, just log the event
      } catch (error) {
        console.error("Error handling group member join:", error);
      }
    });

    socket.on("disconnect", async () => {
      const user = users.get(socket.id);
      if (user) {
        const { userId, username } = user;

        // Remove from memory
        activeUsersById.delete(userId);
        users.delete(socket.id);

        // Update DB status
        await UserModel.findOneAndUpdate(
          { userId },
          { socketId: null, isOnline: false, lastActive: new Date() }
        );

        console.log(`User disconnected: ${username} (${userId})`);
      } else {
        console.log(`Socket disconnected: ${socket.id}`);
      }
    });
  });

  return io;
};

export const getIO = (): Server => {
  if (!io) throw new Error("Socket.io not initialized");
  return io;
};