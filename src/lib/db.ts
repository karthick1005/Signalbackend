import mongoose from "mongoose";
import dotenv from "dotenv";

dotenv.config();

const connectToDatabase = async (): Promise<void> => {
  if (mongoose.connection.readyState) {
    console.log("Using existing MongoDB connection.");
    return;
  }

  try {
    await mongoose.connect(process.env.MONGODB_URI as string);
    console.log("Connected to MongoDB");
  } catch (error) {
    console.error("MongoDB connection error:", error);
    throw new Error("Error connecting to MongoDB");
  }
};

export default connectToDatabase;
