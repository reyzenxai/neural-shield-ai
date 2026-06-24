import { Router } from "express";

import { authenticate, requireAdmin } from "../middleware/auth.middleware";
import * as admin from "../controllers/admin.controller";

const router = Router();

// All admin routes: authenticated + admin-role required
router.use(authenticate, requireAdmin());

router.get("/stats",        admin.getStats);
router.get("/users",        admin.getUsers);
router.get("/users/:id",    admin.getUser);
router.get("/scans",        admin.getScans);
router.get("/feedback",     admin.getFeedback);
router.get("/logs",         admin.getLogs);

export default router;
