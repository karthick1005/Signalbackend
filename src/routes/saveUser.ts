import { Router } from "express";
import { createUser, getAllUsers, getUser, getUserDetails } from "../controller/saveUserController.js";
import { uploadPrekeys,requestPrekey } from "../controller/prekeycontroller.js";
import multer from 'multer';
import { proxyFirebaseFile, uploadmedia } from "../controller/mediaupload.js";


const router = Router();
const upload = multer({ storage: multer.memoryStorage() });

router.post("/", createUser as never);
router.post("/details", getUserDetails as never);
router.post("/get-user", getUser as never);
router.post("/get-all", getAllUsers as never);
router.post("/upload-prekeys", uploadPrekeys as never);
router.post("/request-prekey",requestPrekey as never)
router.post("/media-upload",upload.single('file'), uploadmedia);
router.get("/proxy",proxyFirebaseFile as never)
export default router;
