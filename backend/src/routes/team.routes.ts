import { Router } from "express";
import {
  teamController,
  inviteMemberSchema,
  updateRoleSchema,
} from "../controllers/team.controller";
import { authenticate } from "../middleware/auth";
import { validate } from "../middleware/validate";

const router = Router();

router.use(authenticate);

// My invites
router.get("/invites/pending", teamController.getMyInvites);
router.post("/invites/:token/accept", teamController.acceptInvite);
router.post("/invites/:token/decline", teamController.declineInvite);

// Project member management (nested under /projects/:projectId)
router.get("/:projectId/members", teamController.getMembers);
router.post("/:projectId/members/invite", validate(inviteMemberSchema), teamController.inviteMember);
router.patch("/:projectId/members/:memberId/role", validate(updateRoleSchema), teamController.updateMemberRole);
router.delete("/:projectId/members/:memberId", teamController.removeMember);
router.delete("/:projectId/members/leave", teamController.leaveProject);
router.get("/:projectId/invites", teamController.getProjectInvites);

export default router;
