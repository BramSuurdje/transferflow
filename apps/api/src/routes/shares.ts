import { zValidator } from "@hono/zod-validator"
import { createId } from "@paralleldrive/cuid2"
import {
  INTERNAL_MAX_FILE_SIZE_BYTES,
  MAX_FILE_SIZE_BYTES,
  RETENTION_OPTIONS,
} from "@transferflow/shared"
import { Hono } from "hono"
import { z } from "zod"

import { hasInternalUploadAccess } from "../lib/internal-key"
import {
  completeShare,
  createPendingShare,
  createShareDownloadUrl,
  getReadySharePublic,
} from "../lib/shares"

function createShareSchema(unlimited: boolean) {
  return z.object({
    filename: z.string().min(1).max(512),
    contentType: z.string().min(1).max(256),
    size: z
      .number()
      .int()
      .positive()
      .max(unlimited ? INTERNAL_MAX_FILE_SIZE_BYTES : MAX_FILE_SIZE_BYTES),
    retention: z.enum(RETENTION_OPTIONS),
  })
}

const completeShareSchema = z.object({
  parts: z
    .array(
      z.object({
        partNumber: z.number().int().min(1).max(10_000),
        etag: z.string().min(1),
      })
    )
    .optional(),
})

export const sharesRoutes = new Hono()
  .get("/upload-access", (c) => {
    return c.json({ unlimited: hasInternalUploadAccess(c) })
  })
  .post("/", async (c) => {
    const unlimited = hasInternalUploadAccess(c)
    const parsed = createShareSchema(unlimited).safeParse(await c.req.json())
    if (!parsed.success) {
      return c.json({ error: "Invalid request body" }, 400)
    }
    const body = parsed.data

    const id = createId()
    const createdAt = Date.now()

    const { upload } = await createPendingShare({
      id,
      filename: body.filename,
      contentType: body.contentType,
      size: body.size,
      retention: body.retention,
      createdAt,
    })

    return c.json({ id, upload }, 201)
  })
  .post(
    "/:id/complete",
    zValidator("json", completeShareSchema),
    async (c) => {
      const id = c.req.param("id")
      const body = c.req.valid("json")
      const result = await completeShare(id, body.parts)

      if (result === "missing") {
        return c.json({ error: "Share not found" }, 404)
      }
      if (result === "not_pending") {
        return c.json({ error: "Share is not awaiting upload" }, 409)
      }
      if (result === "invalid_parts") {
        return c.json({ error: "Multipart parts are required" }, 400)
      }
      if (result === "object_missing") {
        return c.json({ error: "Upload not found in storage" }, 400)
      }

      return c.json({ share: await getReadySharePublic(id) })
    }
  )
  .get("/:id", async (c) => {
    const share = await getReadySharePublic(c.req.param("id"))
    if (!share) {
      return c.json({ error: "Share not found or expired" }, 404)
    }
    return c.json({ share })
  })
  .post("/:id/download", async (c) => {
    const download = await createShareDownloadUrl(c.req.param("id"))
    if (!download) {
      return c.json({ error: "Share not found or expired" }, 404)
    }
    return c.json(download)
  })
