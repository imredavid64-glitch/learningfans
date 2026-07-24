import { z } from "zod"

export const emailSchema = z
  .string()
  .min(1, "Email is required")
  .email("Invalid email format")
  .max(255, "Email too long")

export const passwordSchema = z
  .string()
  .min(6, "Password must be at least 6 characters")
  .max(128, "Password too long")

export const displayNameSchema = z
  .string()
  .min(1, "Display name is required")
  .max(50, "Display name too long")
  .regex(/^[a-zA-Z0-9 _-]+$/, "Display name can only contain letters, numbers, spaces, hyphens, and underscores")

export const slugSchema = z
  .string()
  .min(1, "Slug is required")
  .max(100, "Slug too long")
  .regex(/^[a-z0-9-]+$/, "Slug must be lowercase alphanumeric with hyphens")

export const titleSchema = z
  .string()
  .min(1, "Title is required")
  .max(200, "Title too long")

export const bodySchema = z
  .string()
  .min(1, "Body is required")
  .max(10000, "Body too long")

export const urlSchema = z
  .string()
  .url("Invalid URL")
  .max(2048, "URL too long")
  .refine(
    (url) => {
      try {
        const parsed = new URL(url)
        return parsed.protocol === "https:" || parsed.protocol === "http:"
      } catch {
        return false
      }
    },
    { message: "URL must use http or https protocol" },
  )

export const signUpSchema = z.object({
  email: emailSchema,
  password: passwordSchema,
  displayName: displayNameSchema,
})

export const signInSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, "Password is required"),
})

export const createClassSchema = z.object({
  name: z.string().min(1, "Class name is required").max(100, "Class name too long"),
  description: z.string().max(2000, "Description too long").optional().default(""),
  slug: slugSchema,
  classCode: z.string().max(20, "Class code too long").optional().default(""),
  semester: z.string().max(20, "Semester too long").optional().default(""),
  instructor: z.string().max(100, "Instructor name too long").optional().default(""),
  department: z.string().max(100, "Department too long").optional().default(""),
})

export const threadSchema = z.object({
  title: titleSchema,
  body: bodySchema,
})

export const postSchema = z.object({
  body: bodySchema,
})

export const reportSchema = z.object({
  reason: z.string().min(1, "Reason is required").max(2000, "Reason too long"),
})

export const eventSchema = z.object({
  title: titleSchema,
  description: z.string().max(2000, "Description too long").optional().default(""),
  startsAt: z.string().min(1, "Start time is required"),
  endsAt: z.string().min(1, "End time is required"),
  allDay: z.boolean().optional().default(false),
})

export const gradeSchema = z.object({
  score: z.number().min(0).max(100, "Score must be between 0 and 100"),
  feedback: z.string().max(2000, "Feedback too long").optional().default(""),
})

export function validateOrThrow<T>(schema: z.ZodType<T>, data: unknown): T {
  const result = schema.safeParse(data)
  if (!result.success) {
    let msg = "Validation failed"
    try {
      const parsed = JSON.parse(result.error.message)
      if (Array.isArray(parsed) && parsed.length > 0) {
        msg = parsed[0].message || msg
      }
    } catch {
      msg = result.error.message
    }
    throw new Error(msg)
  }
  return result.data
}
