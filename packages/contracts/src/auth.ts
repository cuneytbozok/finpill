import { z } from "zod";

export const SessionResponseSchema = z.strictObject({
  userId: z.string().startsWith("user_"),
});
