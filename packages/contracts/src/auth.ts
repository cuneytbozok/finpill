import { z } from "zod";

export const SessionResponseSchema = z.strictObject({
  userId: z.string().startsWith("user_"),
});

export const ProfileSchema = z.strictObject({
  user_id: z.string().startsWith("user_"),
  display_name: z.string().min(1).max(80),
});

/** `profile` is null until the signed-in, eligible user creates one. */
export const ProfileResponseSchema = z.strictObject({
  profile: ProfileSchema.nullable(),
});

export type Profile = z.infer<typeof ProfileSchema>;
