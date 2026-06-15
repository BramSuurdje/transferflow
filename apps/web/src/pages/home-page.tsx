import {
  MAX_FILE_SIZE_BYTES,
  RETENTION_LABELS,
  RETENTION_OPTIONS,
  retentionExpiresAt,
  type Retention,
} from "@transferflow/shared"
import { Upload, X } from "lucide-react"
import * as React from "react"

import { Button } from "@transferflow/ui/components/button"
import { Card, CardContent, CardFooter } from "@transferflow/ui/components/card"
import {
  FileUpload,
  FileUploadDropzone,
  FileUploadItem,
  FileUploadItemDelete,
  FileUploadItemMetadata,
  FileUploadItemPreview,
  FileUploadList,
  FileUploadTrigger,
} from "@transferflow/ui/components/file-upload"
import { Label } from "@transferflow/ui/components/label"
import {
  Select,
  SelectItem,
  SelectPopup,
  SelectTrigger,
  SelectValue,
} from "@transferflow/ui/components/select"
import {
  UploadButton,
  type UploadButtonPhase,
} from "@transferflow/ui/components/upload-button"

import { completeShare, createShare } from "@/lib/api"
import { hasUnlimitedUpload } from "@/lib/internal-key"
import { addUploadHistoryEntry } from "@/lib/upload-history"
import { uploadShare } from "@/lib/upload"
import { toast } from "@transferflow/ui/components/toast"
import { useNavigate } from "react-router-dom"

const SUCCESS_HOLD_MS = 720

type UploadUiState = {
  phase: UploadButtonPhase
  progress: number
  label: string
}

type UploadUiAction =
  | { type: "start" }
  | { type: "progress"; progress: number; label: string }
  | { type: "success" }
  | { type: "reset" }

const initialUploadUi: UploadUiState = {
  phase: "idle",
  progress: 0,
  label: "",
}

function uploadUiReducer(
  state: UploadUiState,
  action: UploadUiAction
): UploadUiState {
  switch (action.type) {
    case "start":
      return { phase: "uploading", progress: 0, label: "Preparing…" }
    case "progress":
      return {
        ...state,
        progress: action.progress,
        label: action.label,
      }
    case "success":
      return { ...state, phase: "success", progress: 100, label: "Done" }
    case "reset":
      return initialUploadUi
    default:
      return state
  }
}

function wait(ms: number) {
  return new Promise<void>((resolve) => {
    window.setTimeout(resolve, ms)
  })
}

export function HomePage() {
  const navigate = useNavigate()
  const [files, setFiles] = React.useState<File[]>([])
  const [retention, setRetention] = React.useState<Retention>("24h")
  const [uploadUi, dispatchUploadUi] = React.useReducer(
    uploadUiReducer,
    initialUploadUi
  )

  const file = files[0] ?? null
  const isUploading = uploadUi.phase !== "idle"
  const unlimitedUpload = hasUnlimitedUpload()

  const onFileReject = React.useCallback((rejected: File, message: string) => {
    toast.error(message, { description: rejected.name })
  }, [])

  const onShare = async () => {
    if (!file) {
      toast.error("Choose a file")
      return
    }

    dispatchUploadUi({ type: "start" })

    try {
      const { id, upload } = await createShare({
        filename: file.name,
        contentType: file.type || "application/octet-stream",
        size: file.size,
        retention,
      })

      dispatchUploadUi({
        type: "progress",
        progress: 8,
        label: "Uploading…",
      })

      const parts = await uploadShare(file, upload, (percent) => {
        dispatchUploadUi({
          type: "progress",
          progress: 8 + Math.round(percent * 0.87),
          label: "Uploading…",
        })
      })

      dispatchUploadUi({
        type: "progress",
        progress: 96,
        label: "Finishing…",
      })
      await completeShare(id, parts)
      addUploadHistoryEntry({
        id,
        filename: file.name,
        expiresAt: retentionExpiresAt(retention),
      })
      dispatchUploadUi({ type: "success" })
      await wait(SUCCESS_HOLD_MS)
      navigate(`/d/${id}`, { replace: true })
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Upload failed")
      dispatchUploadUi({ type: "reset" })
    }
  }

  return (
    <div className="mx-auto flex w-full max-w-lg flex-col gap-4 px-4 py-6">
      <p className="text-center text-sm text-muted-foreground">
        Upload a file, pick how long the link works, and share it.
      </p>

      <Card>
        <CardContent className="flex flex-col gap-6 pt-6">
          <FileUpload
            maxFiles={1}
            maxSize={unlimitedUpload ? undefined : MAX_FILE_SIZE_BYTES}
            value={files}
            disabled={isUploading}
            onValueChange={setFiles}
            onFileReject={onFileReject}
          >
            <FileUploadDropzone className="min-h-36">
              <div className="flex flex-col items-center gap-2 text-center">
                <div className="flex items-center justify-center rounded-full border p-2.5">
                  <Upload />
                </div>
                <p className="text-sm font-medium">Drop a file here</p>
                <p className="text-xs text-muted-foreground">
                  Any file up to 2 GB.
                </p>
                <FileUploadTrigger asChild>
                  <Button variant="outline" type="button" size="sm">
                    Browse
                  </Button>
                </FileUploadTrigger>
              </div>
            </FileUploadDropzone>

            {file ? (
              <FileUploadList>
                <FileUploadItem value={file}>
                  <FileUploadItemPreview />
                  <FileUploadItemMetadata />
                  <FileUploadItemDelete asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="size-8 shrink-0"
                      type="button"
                    >
                      <X />
                      <span className="sr-only">Remove file</span>
                    </Button>
                  </FileUploadItemDelete>
                </FileUploadItem>
              </FileUploadList>
            ) : null}
          </FileUpload>

          <div className="flex flex-col gap-3 text-sm">
            <Label htmlFor="retention">
              How long should the link be valid?
            </Label>
            <Select
              value={retention}
              onValueChange={(value) => {
                if (value) setRetention(value as Retention)
              }}
              disabled={isUploading}
            >
              <SelectTrigger size="sm" id="retention" className="w-fit min-w-28">
                <SelectValue />
              </SelectTrigger>
              <SelectPopup>
                {RETENTION_OPTIONS.map((option) => (
                  <SelectItem key={option} value={option}>
                    {RETENTION_LABELS[option]}
                  </SelectItem>
                ))}
              </SelectPopup>
            </Select>
          </div>
        </CardContent>
        <CardFooter className="flex flex-col gap-3">
          <UploadButton
            className="w-full"
            disabled={!file}
            phase={uploadUi.phase}
            progress={uploadUi.progress}
            label={uploadUi.label}
            onClick={() => void onShare()}
          />
        </CardFooter>
      </Card>
    </div>
  )
}
