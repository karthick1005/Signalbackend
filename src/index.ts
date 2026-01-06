import express, { Request, Response } from "express";
import dotenv from "dotenv";
import cors from "cors";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import { createServer } from "http";
import { initializeSocket } from "./socket/socket.js";
import connectToDatabase from "./lib/db.js";
import userRoute from "./routes/saveUser.js";
import getUser from "./routes/saveUser.js";
import keyRotationRoute from "./routes/keyRotation.js";
import groupRoute from "./routes/groupRoutes.js";
dotenv.config();

const app = express();
const server = createServer(app);

// Initialize Socket.IO
initializeSocket(server);

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
});

app.use(limiter);
app.use(helmet());
app.use(cors({
  origin: ["http://localhost:3000", "http://localhost:8000"],
  methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization", "Accept"],
  credentials: true
}));

// Handle preflight requests
app.options('*', cors({
  origin: ["http://localhost:3000", "http://localhost:8000"],
  methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization", "Accept"],
  credentials: true
}));
app.use(express.json());

app.get("/", async (_req: Request, res: Response) => {
  try {
    await connectToDatabase();
    res.send("Hello, TypeScript Backend!");
  } catch (error) {
    res.status(500).send("Database connection error.");
  }
});

app.use("/api/user", userRoute);
app.use("/api/keys", keyRotationRoute);
app.use("/api/groups", groupRoute);

const PORT = process.env.PORT || 3000;

connectToDatabase()
  .then(() => {
    server.listen(PORT, () => console.log(`Server running on port ${PORT}`));
  })
  .catch((err) => {
    console.error("Failed to connect to MongoDB. Exiting...");
    process.exit(1);
  });