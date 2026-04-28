import { Router } from "express";
import { getUsers } from "../../controllers/user/user.controller";
import { userMiddleware } from "../../middlewares/user/user.middleware";
import { validateUserPayload } from "../../validations/user/user.validation";

const router = Router();

router.get("/", getUsers);
router.post("/", userMiddleware, (req, res) => {
  res.status(201).json(validateUserPayload(req.body));
});

export default router;
