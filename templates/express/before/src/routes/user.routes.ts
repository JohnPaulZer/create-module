import { Router } from "express";
import { getUsers } from "../controllers/user.controller";
import { userMiddleware } from "../middlewares/user.middleware";
import { validateUserPayload } from "../validations/user.validation";

const router = Router();

router.get("/", getUsers);
router.post("/", userMiddleware, (req, res) => {
  res.status(201).json(validateUserPayload(req.body));
});

export default router;
