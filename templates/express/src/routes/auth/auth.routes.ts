import { Router } from "express";
import * as authController from "../../controllers/auth/auth.controller";
import { authMiddleware } from "../../middlewares/auth/auth.middleware";

const router = Router();

router.get("/", authController.getAll);
router.get("/:id", authController.getById);
router.post("/", authMiddleware, authController.create);
router.put("/:id", authMiddleware, authController.update);
router.delete("/:id", authController.remove);

export default router;
