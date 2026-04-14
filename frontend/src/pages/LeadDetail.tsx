import { useState, useEffect } from "react"
import { useParams } from "react-router-dom"
import { get, patch } from "@/lib/api"
import { formatTime } from "@/lib/utils"
import { getEmailStatus } from "@/lib/status"
import { parseApiError } from "@/lib/errors"
import { useBreadcrumbs } from "@/contexts/BreadcrumbContext"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { Textarea } from "@/components/ui/textarea"
import {
    Mail,
    Building2,
    Briefcase,
    CheckCircle2,
    Clock,
    Send,
    AlertCircle,
    Trash2,
    Reply
} from "lucide-react"
import DeleteLeadModal from "@/components/DeleteLeadModal"

type Lead = {
    id: string
    campaign_id: string
    email: string
    first_name: string
    last_name: string
    company: string | null
    title: string | null
    notes: string | null
    status: string
    has_replied: boolean
    current_sequence: number
    next_email_at: string | null
    created_at: string
    updated_at: string
    campaign_name: string
}

type EmailActivity = {
    id: string
    sequence_number: number
    subject: string
    body: string
    status: string
    sent_at: string | null
    created_at: string
}


function getLeadStatusColor(status: string) {
    switch (status) {
        case "active": return "bg-green-100 text-green-700"
        case "replied": return "bg-blue-100 text-blue-700"
        case "completed": return "bg-gray-100 text-gray-700"
        case "failed": return "bg-red-100 text-red-700"
        default: return "bg-yellow-100 text-yellow-700"
    }
}

function formatDate(dateString: string | null) {
    if (!dateString) return "Not scheduled"
    const date = new Date(dateString)
    const formatted = formatTime(dateString)
    const dateStr = date.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })
    return formatted ? `${dateStr}, ${formatted.time} ${formatted.timezone}` : date.toLocaleString()
}

function LeadInfoCard({
    loading,
    lead
}: {
    loading: boolean;
    lead: Lead | null
}) {
    return (
        <Card>
            <CardHeader>
                <CardTitle>Lead Information</CardTitle>
            </CardHeader>
            <CardContent>
                {loading ? (
                    <div className="space-y-3">
                        <Skeleton className="h-6 w-48" />
                        <Skeleton className="h-4 w-64" />
                        <Skeleton className="h-4 w-56" />
                    </div>
                ) : lead ? (
                    <div className="space-y-4">
                        <div>
                            <h2 className="text-2xl font-bold">{lead.first_name} {lead.last_name}</h2>
                            <div className="flex items-center gap-2 mt-2 min-w-0">
                                <Mail size={16} className="text-muted-foreground flex-shrink-0" />
                                <a href={`mailto:${lead.email}`} className="text-primary hover:underline truncate" title={lead.email}>
                                    {lead.email}
                                </a>
                            </div>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div className="flex items-center gap-2">
                                <Building2 size={16} className="text-muted-foreground flex-shrink-0" />
                                <span className="break-words">{lead.company || "-"}</span>
                            </div>
                            <div className="flex items-center gap-2">
                                <Briefcase size={16} className="text-muted-foreground flex-shrink-0" />
                                <span className="break-words">{lead.title || "-"}</span>
                            </div>
                        </div>

                        <div className="flex flex-wrap items-center gap-x-4 gap-y-3 pt-2 border-t">
                            <div>
                                <p className="text-xs text-muted-foreground mb-1">Status</p>
                                <span className={`px-2 py-1 rounded text-xs font-medium ${getLeadStatusColor(lead.status)}`}>
                                    {lead.status}
                                </span>
                            </div>
                            <div>
                                <p className="text-xs text-muted-foreground mb-1">Sequence</p>
                                <span className="font-medium">{lead.current_sequence}</span>
                            </div>
                            <div>
                                <p className="text-xs text-muted-foreground mb-1">Replied</p>
                                <span className="font-medium">{lead.has_replied ? "Yes" : "No"}</span>
                            </div>
                            <div className="w-full sm:w-auto pt-2 border-t sm:pt-0 sm:border-t-0 mt-1 sm:mt-0">
                                <p className="text-xs text-muted-foreground mb-1">Next Email</p>
                                <span className="text-sm">
                                    {lead.status === "completed" || lead.status === "replied" || lead.status === "failed"
                                        ? "-"
                                        : formatDate(lead.next_email_at)}
                                </span>
                            </div>
                        </div>
                    </div>
                ) : null}
            </CardContent>
        </Card>
    )
}

function ActivityTimeline({
    loading,
    activity
}: {
    loading: boolean;
    activity: EmailActivity[]
}) {
    const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set())

    const toggleExpand = (id: string) => {
        setExpandedIds(prev => {
            const next = new Set(prev)
            if (next.has(id)) {
                next.delete(id)
            } else {
                next.add(id)
            }
            return next
        })
    }

    const getStatusDotColor = (status: string) => {
        switch (status) {
            case "sent": return "bg-green-500"
            case "pending": return "bg-yellow-500"
            case "failed": return "bg-red-500"
            case "received": return "bg-blue-500"
            default: return "bg-muted-foreground"
        }
    }

    return (
        <Card>
            <CardHeader>
                <CardTitle>Email Activity</CardTitle>
            </CardHeader>
            <CardContent>
                {loading ? (
                    <div className="space-y-3">
                        {[1, 2, 3].map(i => (
                            <Skeleton key={i} className="h-16 w-full" />
                        ))}
                    </div>
                ) : activity.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground">
                        No emails sent yet
                    </div>
                ) : (
                    <div className="relative">
                        {/* Vertical timeline line */}
                        <div className="absolute left-[7px] top-2 bottom-2 w-0.5 bg-border" />

                        <div className="space-y-4">
                            {activity.map((email) => {
                                const isExpanded = expandedIds.has(email.id)

                                return (
                                    <div key={email.id} className="relative pl-8">
                                        {/* Timeline dot */}
                                        <div
                                            className={`absolute left-0 top-1.5 w-4 h-4 rounded-full border-2 border-background ${getStatusDotColor(email.status)} ring-2 ring-background`}
                                        />

                                        {/* Content */}
                                        <div
                                            className={`rounded-lg border p-3 cursor-pointer transition-all hover:bg-muted/50 ${isExpanded ? 'bg-muted/30' : ''}`}
                                            onClick={() => toggleExpand(email.id)}
                                        >
                                            {/* Header - always visible */}
                                            <div className="flex flex-col gap-1">
                                                <div className="flex items-start justify-between">
                                                    <div className="flex items-center gap-2">
                                                        {email.status === "sent" ? (
                                                            <Send size={14} className="text-green-600 flex-shrink-0" />
                                                        ) : email.status === "pending" ? (
                                                            <Clock size={14} className="text-yellow-600 flex-shrink-0" />
                                                        ) : email.status === "received" ? (
                                                            <Reply size={14} className="text-blue-600 flex-shrink-0" />
                                                        ) : (
                                                            <AlertCircle size={14} className="text-red-600 flex-shrink-0" />
                                                        )}
                                                        <span className="font-medium text-sm">
                                                            {email.status === "received" || email.sequence_number <= 0
                                                                ? "Reply Received"
                                                                : `Email #${email.sequence_number}`}
                                                        </span>
                                                        <span className="text-xs text-muted-foreground hidden sm:inline">
                                                            {email.sent_at ? formatDate(email.sent_at) : formatDate(email.created_at)}
                                                        </span>
                                                    </div>
                                                    <div className="flex items-center gap-2">
                                                        {(() => { const s = getEmailStatus(email.status); return (
                                                            <Badge variant={s.variant} className={s.className}>{s.label}</Badge>
                                                        ) })()}
                                                        <svg
                                                            className={`w-4 h-4 text-muted-foreground transition-transform ${isExpanded ? 'rotate-180' : ''}`}
                                                            fill="none"
                                                            viewBox="0 0 24 24"
                                                            stroke="currentColor"
                                                        >
                                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                                                        </svg>
                                                    </div>
                                                </div>
                                                <div className="text-xs text-muted-foreground sm:hidden pl-6">
                                                    {email.sent_at ? formatDate(email.sent_at) : formatDate(email.created_at)}
                                                </div>
                                            </div>

                                            {/* Subject - always visible but truncated when collapsed */}
                                            <p className={`text-sm mt-2 ${isExpanded ? '' : 'line-clamp-1'}`}>
                                                <span className="font-medium">Subject:</span> {email.subject}
                                            </p>

                                            {/* Body - only visible when expanded */}
                                            {isExpanded && (
                                                <div className="mt-3 pt-3 border-t">
                                                    <p className="text-xs text-muted-foreground mb-1">Body:</p>
                                                    <div
                                                        className="text-sm [&>p]:mb-3 [&>p:last-child]:mb-0"
                                                        dangerouslySetInnerHTML={{
                                                            __html: email.status === "failed"
                                                                ? "We couldn't send this email. Please check if the email address is valid."
                                                                : email.body
                                                        }}
                                                    />
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                )
                            })}
                        </div>
                    </div>
                )}
            </CardContent>
        </Card>
    )
}

function NotesCard({
    notes,
    setNotes,
    handleSaveNotes,
    marking,
    handleMarkAsReplied,
    loading,
    saving,
    leadReplied
}: {
    notes: string;
    setNotes: (notes: string) => void;
    handleSaveNotes: () => void;
    marking: boolean;
    handleMarkAsReplied: () => void;
    loading: boolean;
    saving: boolean;
    leadReplied: boolean;
}) {
    return (
        <Card>
            <CardHeader>
                <CardTitle>Notes</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
                <Textarea
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="Add campaign-specific notes about this lead..."
                    className="min-h-[120px]"
                    disabled={loading}
                />
                <div className="flex flex-col sm:flex-row gap-2">
                    <Button onClick={handleSaveNotes} disabled={saving || loading} className="w-full sm:w-auto">
                        {saving ? "Saving..." : "Save Notes"}
                    </Button>
                    {leadReplied && (
                        <Button
                            variant="outline"
                            onClick={handleMarkAsReplied}
                            disabled={marking || loading}
                            className="gap-2 w-full sm:w-auto"
                        >
                            <CheckCircle2 size={16} />
                            {marking ? "Marking..." : "Mark as Replied"}
                        </Button>
                    )}
                </div>
            </CardContent>
        </Card>
    )
}

export default function LeadDetail() {
    const { campaignId, leadId } = useParams<{ campaignId: string; leadId: string }>()
    const [lead, setLead] = useState<Lead | null>(null)
    const [activity, setActivity] = useState<EmailActivity[]>([])
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)
    const [notes, setNotes] = useState("")
    const [saving, setSaving] = useState(false)
    const [marking, setMarking] = useState(false)
    const [showDeleteModal, setShowDeleteModal] = useState(false)

    useBreadcrumbs([
        { label: "Campaigns", href: "/" },
        { label: lead?.campaign_name || "Campaign", href: campaignId ? `/campaigns/${campaignId}` : "/" },
        { label: lead ? `${lead.first_name} ${lead.last_name}` : "Loading..." },
    ])

    const fetchData = async () => {
        if (!leadId || !campaignId) return

        try {
            setLoading(true)
            const [leadData, activityData] = await Promise.all([
                get<Lead>(`/leads/${leadId}`),
                get<EmailActivity[]>(`/leads/${leadId}/activity?campaign_id=${campaignId}`)
            ])
            setLead(leadData)
            setNotes(leadData.notes || "")
            setActivity(activityData)
            setError(null)
        } catch (err) {
            setError(parseApiError(err))
        } finally {
            setLoading(false)
        }
    }

    useEffect(() => {
        fetchData()
    }, [leadId, campaignId])

    const handleSaveNotes = async () => {
        if (!leadId || !lead) return

        const previousNotes = lead.notes

        // Optimistic update
        setLead({ ...lead, notes })
        setSaving(true)

        try {
            await patch(`/leads/${leadId}`, { notes })
            toast.success("Notes saved successfully")
        } catch (err) {
            // Revert on error
            setLead({ ...lead, notes: previousNotes })
            setNotes(previousNotes || "")

            toast.error(parseApiError(err))
        } finally {
            setSaving(false)
        }
    }

    const handleMarkAsReplied = async () => {
        if (!leadId || !lead) return

        const previousStatus = lead.status
        const previousReplied = lead.has_replied

        // Optimistic update
        setLead({ ...lead, has_replied: true, status: "replied" })
        setMarking(true)

        try {
            await patch(`/leads/${leadId}`, { has_replied: true, status: "replied" })
            toast.success("Lead marked as replied")
        } catch (err) {
            // Revert on error
            setLead({ ...lead, has_replied: previousReplied, status: previousStatus })

            toast.error(parseApiError(err))
        } finally {
            setMarking(false)
        }
    }

    if (error) {
        return (
            <div className="p-8">
                <div className="max-w-4xl mx-auto">
                    <Alert variant="destructive">
                        <AlertCircle className="h-4 w-4" />
                        <AlertDescription>{error}</AlertDescription>
                    </Alert>
                </div>
            </div>
        )
    }

    return (
        <div className="min-h-screen bg-background p-8">
            <div className="max-w-4xl mx-auto space-y-6">
                {/* Header with back link and delete button */}
                <div className="flex justify-between items-center">
                    <div />
                    {loading ? (
                        <Skeleton className="h-10 w-10" />
                    ) : lead && (
                        <Button
                            variant="outline"
                            size="icon"
                            onClick={() => setShowDeleteModal(true)}
                        >
                            <Trash2 color="#ef4343" size={16} />
                        </Button>
                    )}
                </div>

                {/* Lead Info Card */}
                <LeadInfoCard
                    loading={loading}
                    lead={lead}
                />

                {/* Activity Timeline */}
                <ActivityTimeline
                    loading={loading}
                    activity={activity}
                />

                {/* Notes Section */}
                <NotesCard
                    loading={loading}
                    notes={notes}
                    setNotes={setNotes}
                    handleSaveNotes={handleSaveNotes}
                    marking={marking}
                    handleMarkAsReplied={handleMarkAsReplied}
                    saving={saving}
                    leadReplied={lead !== null && !lead.has_replied}
                />

                {/* Delete Lead Modal */}
                {lead && campaignId && (
                    <DeleteLeadModal
                        open={showDeleteModal}
                        onClose={() => setShowDeleteModal(false)}
                        campaignId={campaignId}
                        leadId={lead.id}
                        leadName={`${lead.first_name} ${lead.last_name}`}
                    />
                )}
            </div>
        </div>
    )
}