import { useState } from "react"
import { post } from "@/lib/api"
import { parseApiError } from "@/lib/errors"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog"
import { Skeleton } from "@/components/ui/skeleton"
import { Eye, RefreshCw } from "lucide-react"

type Lead = {
    id: string
    first_name: string
    last_name: string
    email: string
}

type PreviewResult = {
    subject: string
    body: string
}

export default function PreviewEmailModal({
    open,
    onClose,
    campaignId,
    leads,
}: {
    open: boolean
    onClose: () => void
    campaignId: string
    leads: Lead[]
}) {
    const [selectedLeadId, setSelectedLeadId] = useState<string>(leads[0]?.id || "")
    const [preview, setPreview] = useState<PreviewResult | null>(null)
    const [loading, setLoading] = useState(false)

    const handleGenerate = async () => {
        if (!selectedLeadId) return
        setLoading(true)
        setPreview(null)
        try {
            const result = await post<PreviewResult>(
                `/campaigns/${campaignId}/preview?lead_id=${selectedLeadId}`,
                {},
            )
            setPreview(result)
        } catch (err) {
            toast.error(parseApiError(err))
        } finally {
            setLoading(false)
        }
    }

    const selectedLead = leads.find(l => l.id === selectedLeadId)

    return (
        <Dialog open={open} onOpenChange={(isOpen) => { if (!isOpen) { onClose(); setPreview(null) } }}>
            <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle>Preview Email</DialogTitle>
                    <DialogDescription>
                        Generate a sample email to see how your campaign will look.
                    </DialogDescription>
                </DialogHeader>

                <div className="space-y-4">
                    {/* Lead selector */}
                    <div className="space-y-1.5">
                        <label className="text-sm font-medium">Select a lead</label>
                        <select
                            value={selectedLeadId}
                            onChange={(e) => { setSelectedLeadId(e.target.value); setPreview(null) }}
                            className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm"
                        >
                            {leads.map(lead => (
                                <option key={lead.id} value={lead.id}>
                                    {lead.first_name} {lead.last_name} ({lead.email})
                                </option>
                            ))}
                        </select>
                    </div>

                    <Button
                        onClick={handleGenerate}
                        disabled={loading || !selectedLeadId}
                        className="gap-2"
                        size="sm"
                    >
                        {loading ? (
                            <>
                                <RefreshCw size={14} className="animate-spin" />
                                Generating...
                            </>
                        ) : preview ? (
                            <>
                                <RefreshCw size={14} />
                                Regenerate
                            </>
                        ) : (
                            <>
                                <Eye size={14} />
                                Generate Preview
                            </>
                        )}
                    </Button>

                    {/* Preview result */}
                    {loading && (
                        <div className="space-y-3 border rounded-lg p-4">
                            <Skeleton className="h-5 w-3/4" />
                            <Skeleton className="h-4 w-full" />
                            <Skeleton className="h-4 w-full" />
                            <Skeleton className="h-4 w-2/3" />
                        </div>
                    )}

                    {preview && !loading && (
                        <div className="border rounded-lg overflow-hidden">
                            <div className="bg-muted px-4 py-2.5 border-b">
                                <p className="text-xs text-muted-foreground">To: {selectedLead?.email}</p>
                                <p className="text-sm font-medium mt-0.5">{preview.subject}</p>
                            </div>
                            <div
                                className="p-4 text-sm leading-relaxed [&>p]:mb-3 [&>p:last-child]:mb-0"
                                dangerouslySetInnerHTML={{ __html: preview.body }}
                            />
                        </div>
                    )}

                    {!preview && !loading && (
                        <div className="text-center py-8 border border-dashed rounded-lg">
                            <p className="text-sm text-muted-foreground">
                                Select a lead and click "Generate Preview" to see a sample email.
                            </p>
                        </div>
                    )}
                </div>
            </DialogContent>
        </Dialog>
    )
}
