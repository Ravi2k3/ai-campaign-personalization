import { useState, useEffect } from "react"
import { useParams, Link } from "react-router-dom"
import { get, patch } from "@/lib/api"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { Textarea } from "@/components/ui/textarea"
import { ArrowLeft, Mail, Building2, Briefcase, CheckCircle2, Clock, Send, AlertCircle } from "lucide-react"

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

function getStatusColor(status: string) {
    switch (status) {
        case "sent": return "bg-green-100 text-green-700"
        case "pending": return "bg-yellow-100 text-yellow-700"
        case "failed": return "bg-red-100 text-red-700"
        default: return "bg-muted text-muted-foreground"
    }
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
    return date.toLocaleString()
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
            setError(err instanceof Error ? err.message : "Failed to fetch lead data")
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

            // Parse error message properly
            let errorMessage = "Failed to save notes"
            if (err instanceof Error) {
                try {
                    const errorObj = JSON.parse(err.message)
                    errorMessage = errorObj.detail || err.message
                } catch {
                    errorMessage = err.message
                }
            }
            toast.error(errorMessage)
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

            // Parse error message properly
            let errorMessage = "Failed to mark as replied"
            if (err instanceof Error) {
                try {
                    const errorObj = JSON.parse(err.message)
                    errorMessage = errorObj.detail || err.message
                } catch {
                    errorMessage = err.message
                }
            }
            toast.error(errorMessage)
        } finally {
            setMarking(false)
        }
    }

    if (error) {
        return (
            <div className="min-h-screen bg-background p-8">
                <div className="max-w-4xl mx-auto">
                    <div className="text-destructive bg-destructive/10 p-4 rounded-lg">{error}</div>
                </div>
            </div>
        )
    }

    return (
        <div className="min-h-screen bg-background p-8">
            <div className="max-w-4xl mx-auto space-y-6">
                {/* Back link */}
                <Link
                    to={`/campaigns/${campaignId}`}
                    className="inline-flex items-center gap-2 text-muted-foreground hover:text-foreground"
                >
                    <ArrowLeft size={16} />
                    Back to {loading ? "Campaign" : lead?.campaign_name}
                </Link>

                {/* Lead Info Card */}
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
                                    <div className="flex items-center gap-2 mt-2">
                                        <Mail size={16} className="text-muted-foreground" />
                                        <a href={`mailto:${lead.email}`} className="text-primary hover:underline">
                                            {lead.email}
                                        </a>
                                    </div>
                                </div>

                                <div className="grid grid-cols-2 gap-4">
                                    <div className="flex items-center gap-2">
                                        <Building2 size={16} className="text-muted-foreground" />
                                        <span>{lead.company || "-"}</span>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <Briefcase size={16} className="text-muted-foreground" />
                                        <span>{lead.title || "-"}</span>
                                    </div>
                                </div>

                                <div className="flex items-center gap-4 pt-2 border-t">
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
                                    {lead.next_email_at && (
                                        <div>
                                            <p className="text-xs text-muted-foreground mb-1">Next Email</p>
                                            <span className="text-sm">{formatDate(lead.next_email_at)}</span>
                                        </div>
                                    )}
                                </div>
                            </div>
                        ) : null}
                    </CardContent>
                </Card>

                {/* Activity Timeline */}
                <Card>
                    <CardHeader>
                        <CardTitle>Email Activity</CardTitle>
                    </CardHeader>
                    <CardContent>
                        {loading ? (
                            <div className="space-y-3">
                                {[1, 2, 3].map(i => (
                                    <Skeleton key={i} className="h-20 w-full" />
                                ))}
                            </div>
                        ) : activity.length === 0 ? (
                            <div className="text-center py-8 text-muted-foreground">
                                No emails sent yet
                            </div>
                        ) : (
                            <div className="space-y-4">
                                {activity.map((email) => (
                                    <div key={email.id} className="border rounded-lg p-4">
                                        <div className="flex items-start justify-between mb-2">
                                            <div className="flex items-center gap-2">
                                                {email.status === "sent" ? (
                                                    <Send size={16} className="text-green-600" />
                                                ) : email.status === "pending" ? (
                                                    <Clock size={16} className="text-yellow-600" />
                                                ) : (
                                                    <AlertCircle size={16} className="text-red-600" />
                                                )}
                                                <span className="font-medium">Email #{email.sequence_number}</span>
                                            </div>
                                            <span className={`px-2 py-1 rounded text-xs font-medium ${getStatusColor(email.status)}`}>
                                                {email.status}
                                            </span>
                                        </div>
                                        <p className="font-medium mb-1">{email.subject}</p>
                                        <p className="text-sm text-muted-foreground mb-2 line-clamp-2">{email.body}</p>
                                        <p className="text-xs text-muted-foreground">
                                            {email.sent_at ? `Sent: ${formatDate(email.sent_at)}` : `Created: ${formatDate(email.created_at)}`}
                                        </p>
                                    </div>
                                ))}
                            </div>
                        )}
                    </CardContent>
                </Card>

                {/* Notes Section */}
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
                        <div className="flex gap-2">
                            <Button onClick={handleSaveNotes} disabled={saving || loading}>
                                {saving ? "Saving..." : "Save Notes"}
                            </Button>
                            {lead && !lead.has_replied && (
                                <Button
                                    variant="outline"
                                    onClick={handleMarkAsReplied}
                                    disabled={marking || loading}
                                    className="gap-2"
                                >
                                    <CheckCircle2 size={16} />
                                    {marking ? "Marking..." : "Mark as Replied"}
                                </Button>
                            )}
                        </div>
                    </CardContent>
                </Card>
            </div>
        </div>
    )
}