import express from "express";
import { createGroup, getGroups } from "../controller/groupController.js";

const router = express.Router();

router.post("/create", createGroup);
router.get("/:userId", getGroups);

export default router;
