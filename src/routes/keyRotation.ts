import express from "express";
import { rotateKeys } from "../controller/keyRotationController.js";

const router = express.Router();

router.post("/rotate", rotateKeys);

export default router;
