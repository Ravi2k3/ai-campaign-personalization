import { useState, useRef } from "react"
import { API_URL } from "@/lib/api"
import { parseApiError } from "@/lib/errors"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { Alert, AlertDescription } from "@/components/ui/alert"
import {
    Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle,
} from "@/components/ui/dialog"
import { FileText, Upload, Trash2, Eye, AlertCircle, Loader2 } from "lucide-react"

const ACCEPT = ".pdf,.docx,.pptx,.txt,.md"
const MAX_MB = 10

type Props = {
    campaignId: string
    canEdit: boolean
    documentName: string | null
    brief: string | null
    onChange: () => void
}

export default function ProductDocumentCard({
    campaignId,
    canEdit,
    documentName,
    brief,
    onChange,
}: Props) {
    const [uploading, setUploading] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [isDragging, setIsDragging] = useState(false)
    const [showBrief, setShowBrief] = useState(false)
    const fileInputRef = useRef<HTMLInputElement>(null)

    const hasDocument = !!brief && !!documentName

    const uploadFile = async (file: File) => {
        if (!canEdit) {
            setError("Only draft or paused campaigns can accept a new document.")
            return
        }

        const ext = "." + (file.name.split(".").pop() || "").toLowerCase()
        if (!ACCEPT.includes(ext)) {
            setError(`Unsupported file type. Allowed: ${ACCEPT}.`)
            return
        }
        if (file.size > MAX_MB * 1024 * 1024) {
            setError(`File too large. Max ${MAX_MB} MB.`)
            return
        }

        setError(null)
        setUploading(true)
        try {
            const form = new FormData()
            form.append("file", file)
            const resp = await fetch(`${API_URL}/campaigns/${campaignId}/document`, {
                method: "POST",
                credentials: "include",
                headers: {
                    // Authorization injected the same way api.ts does it
                    Authorization: `Bearer ${localStorage.getItem("auth_token") || ""}`,
                },
                body: form,
            })
            if (!resp.ok) {
                let detail = `Upload failed (${resp.status})`
                try {
                    const body = await resp.json()
                    if (body?.detail) detail = body.detail
                } catch { /* keep generic */ }
                throw new Error(detail)
            }
            toast.success("Document processed. Brief ready.")
            onChange()
        } catch (err) {
            const msg = err instanceof Error ? err.message : "Upload failed"
            setError(msg)
            toast.error(msg)
        } finally {
            setUploading(false)
        }
    }

    const handleDrop = (e: React.DragEvent) => {
        e.preventDefault()
        setIsDragging(false)
        if (!canEdit || uploading) return
        const file = e.dataTransfer.files?.[0]
        if (file) uploadFile(file)
    }

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0]
        if (file) uploadFile(file)
        // Reset so re-selecting the same file still fires change
        if (fileInputRef.current) fileInputRef.current.value = ""
    }

    const handleDelete = async () => {
        if (!canEdit) return
        if (!confirm("Remove the product document? This clears the brief used for personalization.")) return
        try {
            const resp = await fetch(`${API_URL}/campaigns/${campaignId}/document`, {
                method: "DELETE",
                credentials: "include",
                headers: {
                    Authorization: `Bearer ${localStorage.getItem("auth_token") || ""}`,
                },
            })
            if (!resp.ok) {
                const body = await resp.json().catch(() => ({}))
                throw new Error(body?.detail || `Delete failed (${resp.status})`)
            }
            toast.success("Document removed")
            onChange()
        } catch (err) {
            toast.error(parseApiError(err))
        }
    }

    // ── Render ──────────────────────────────────────────────────────────

    return (
        <div className="bg-card border rounded-xl p-5 space-y-3">
            <div className="flex items-start justify-between gap-3">
                <div>
                    <h2 className="text-[13px] font-semibold tracking-tight">Product document</h2>
                    <p className="text-[11px] text-muted-foreground mt-0.5">
                        Upload a product brief, deck, or datasheet. The LLM will use it for every email in this campaign.
                    </p>
                </div>
                {hasDocument && (
                    <Button size="sm" variant="ghost" onClick={() => setShowBrief(true)} className="gap-1.5">
                        <Eye size={13} />
                        View brief
                    </Button>
                )}
            </div>

            {uploading ? (
                <div className="flex items-center gap-2 p-4 border border-dashed rounded-lg">
                    <Loader2 size={14} className="animate-spin text-muted-foreground" />
                    <div className="flex-1 space-y-2">
                        <p className="text-[12px] text-muted-foreground">Parsing document and summarizing...</p>
                        <Skeleton className="h-2 w-full" />
                    </div>
                </div>
            ) : hasDocument ? (
                <div className="flex items-center gap-3 p-3 border rounded-lg bg-muted/20">
                    <div className="h-9 w-9 rounded-md bg-primary/10 flex items-center justify-center shrink-0">
                        <FileText size={16} className="text-primary" />
                    </div>
                    <div className="min-w-0 flex-1">
                        <p className="text-[13px] font-medium truncate">{documentName}</p>
                        <p className="text-[11px] text-muted-foreground">
                            Brief generated · {brief!.split(/\s+/).filter(Boolean).length} words
                        </p>
                    </div>
                    {canEdit && (
                        <div className="flex items-center gap-1">
                            <Button size="sm" variant="outline" onClick={() => fileInputRef.current?.click()} className="gap-1.5">
                                <Upload size={13} />
                                Replace
                            </Button>
                            <Button size="sm" variant="ghost" onClick={handleDelete} className="text-destructive hover:text-destructive">
                                <Trash2 size={13} />
                            </Button>
                        </div>
                    )}
                </div>
            ) : (
                <label
                    htmlFor="product-doc-input"
                    onDragOver={(e) => { e.preventDefault(); if (canEdit) setIsDragging(true) }}
                    onDragLeave={() => setIsDragging(false)}
                    onDrop={handleDrop}
                    className={`block border-2 border-dashed rounded-lg p-6 text-center transition-colors cursor-pointer ${
                        !canEdit
                            ? "border-muted/50 cursor-not-allowed opacity-60"
                            : isDragging
                                ? "border-primary bg-primary/5"
                                : "border-muted-foreground/25 hover:border-muted-foreground/50"
                    }`}
                >
                    <Upload size={22} className={`mx-auto mb-2 ${isDragging ? "text-primary" : "text-muted-foreground"}`} />
                    <p className="text-[13px] text-muted-foreground">
                        {canEdit ? "Drag & drop or click to upload" : "Only draft or paused campaigns can accept a document"}
                    </p>
                    <p className="text-[11px] text-muted-foreground/70 mt-1">
                        PDF, DOCX, PPTX, TXT, MD · Max {MAX_MB} MB
                    </p>
                </label>
            )}

            <input
                ref={fileInputRef}
                type="file"
                id="product-doc-input"
                accept={ACCEPT}
                className="hidden"
                onChange={handleInputChange}
                disabled={!canEdit || uploading}
            />

            {error && (
                <Alert variant="destructive">
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription>{error}</AlertDescription>
                </Alert>
            )}

            {/* Brief preview modal */}
            <Dialog open={showBrief} onOpenChange={setShowBrief}>
                <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle>Product brief</DialogTitle>
                        <DialogDescription>
                            Summary of <span className="font-medium text-foreground">{documentName}</span>. This is what the LLM sees when personalizing every email.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="text-[13px] leading-relaxed whitespace-pre-wrap font-mono bg-muted/30 p-4 rounded-lg border">
                        {brief}
                    </div>
                </DialogContent>
            </Dialog>
        </div>
    )
}
