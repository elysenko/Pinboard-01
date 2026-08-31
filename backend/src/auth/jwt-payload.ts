import { UserRole } from '@prisma/client';

/**
 * Claims carried by every access token.
 *
 * The identity claim is `userId` (not `sub`) — every guard, decorator and controller
 * in this codebase reads `userId`, so tokens must be minted with the same name.
 */
export interface JwtPayload {
  userId: string;
  email: string;
  role: UserRole;
}

/** What `request.user` holds once JwtStrategy has validated a token. */
export type AuthenticatedUser = JwtPayload;
