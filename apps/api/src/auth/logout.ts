import type { FastifyInstance } from "fastify";
import "@fastify/cookie";

import {
  deleteSession,
  sessionCookieName,
} from "./session.js";
import { getSessionCookieOptions } from "../security.js";

export async function logoutRoute(app: FastifyInstance) {
  app.post("/auth/logout", async (request, reply) => {
    const token = request.cookies[sessionCookieName];

    if (token) {
      await deleteSession(token);
    }

    const cookieOpts = getSessionCookieOptions();
    reply.clearCookie(sessionCookieName, {
      httpOnly: cookieOpts.httpOnly,
      secure: cookieOpts.secure,
      sameSite: cookieOpts.sameSite,
      path: cookieOpts.path,
    });

    return reply.send({
      status: "ok",
    });
  });
}