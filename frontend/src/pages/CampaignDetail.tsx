import { useState, useEffect, useMemo } from "react"
import { useParams, Link } from "react-router-dom"
import { get, patch } from "@/lib/api"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table"
import { ArrowLeft, Upload, UserPlus, Clock, RefreshCw, Users, Search, Play, Pause, Trash2 } from "lucide-react"
import AddLeadModal from "@/components/AddLeadModal"
import ImportCSVModal from "@/components/ImportCSVModal"
import DeleteCampaignModal from "@/components/DeleteCampaignModal"

type Campaign = {
    id: string
    name: string
    sender_name: string
    sender_email: string
    goal: string | null
    follow_up_delay_minutes: number
    max_follow_ups: number
    status: string
}

type Lead = {
    id: string
    campaign_id: string
    email: string
    first_name: string
    last_name: string
    company: string | null
    title: string | null
    status: string
    has_replied: boolean
    current_sequence: number
}

function getStatusColor(status: string) {
    switch (status) {
        case "active": return "bg-green-100 text-green-700"
        case "replied": return "bg-blue-100 text-blue-700"
        case "completed": return "bg-gray-100 text-gray-700"
        case "failed": return "bg-red-100 text-red-700"
        default: return "bg-yellow-100 text-yellow-700"
    }
}

function LeadsTableSkeleton() {
    return (
        <Table>
            <TableHeader className="sticky top-0 bg-background z-10">
                <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Company</TableHead>
                    <TableHead>Title</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Sequence</TableHead>
                </TableRow>
            </TableHeader>
            <TableBody>
                {[1, 2, 3, 4, 5].map((i) => (
                    <TableRow key={i}>
                        <TableCell><Skeleton className="h-4 w-full max-w-32" /></TableCell>
                        <TableCell><Skeleton className="h-4 w-full max-w-40" /></TableCell>
                        <TableCell><Skeleton className="h-4 w-full max-w-24" /></TableCell>
                        <TableCell><Skeleton className="h-4 w-full max-w-24" /></TableCell>
                        <TableCell><Skeleton className="h-4 w-full max-w-16" /></TableCell>
                        <TableCell><Skeleton className="h-4 w-full max-w-8" /></TableCell>
                    </TableRow>
                ))}
            </TableBody>
        </Table>
    )
}

function CampaignDetailsHeader({
    loading,
    campaign,
    setShowAddLead,
    setShowImportCSV,
    onToggleStatus,
    toggling,
    onDelete
}: {
    loading: boolean
    campaign: Campaign | null
    setShowAddLead: (show: boolean) => void
    setShowImportCSV: (show: boolean) => void
    onToggleStatus: () => void
    toggling: boolean
    onDelete: () => void
}) {
    const canStart = campaign?.status === "draft" || campaign?.status === "paused"
    const canStop = campaign?.status === "active"
    const showToggle = canStart || canStop

    return (
        <div className="flex flex-col sm:flex-row justify-between items-start gap-4 mb-8">
            <div className="min-w-0 w-full sm:flex-1">
                {loading ? (
                    <>
                        <Skeleton className="h-8 w-full max-w-48 mb-2" />
                        <Skeleton className="h-4 w-full max-w-64" />
                    </>
                ) : (
                    <>
                        <h1 className="text-3xl font-bold">{campaign?.name}</h1>
                        <p className="text-muted-foreground mt-1">
                            {campaign?.sender_name} &lt;{campaign?.sender_email}&gt;
                        </p>
                    </>
                )}
            </div>
            <div className="flex gap-2 flex-shrink-0">
                {loading ? (
                    <>
                        <Skeleton className="h-10 w-36" />
                        <Skeleton className="h-10 w-28" />
                        <Skeleton className="h-10 w-28" />
                        <Skeleton className="h-10 w-10" />
                    </>
                ) : (
                    <>
                        {showToggle && (
                            <Button
                                variant={canStart ? "default" : "outline"}
                                onClick={onToggleStatus}
                                disabled={toggling}
                                className="gap-2"
                            >
                                {canStart ? (
                                    <>
                                        <Play size={16} />
                                        {toggling ? "Starting..." : "Start"}
                                    </>
                                ) : (
                                    <>
                                        <Pause size={16} />
                                        {toggling ? "Stopping..." : "Pause"}
                                    </>
                                )}
                            </Button>
                        )}
                        <Button variant="outline" onClick={() => setShowImportCSV(true)} className="gap-2">
                            <Upload size={16} />
                            Import CSV
                        </Button>
                        <Button onClick={() => setShowAddLead(true)} className="gap-2">
                            <UserPlus size={16} />
                            Add Lead
                        </Button>
                        <Button variant="outline" size="icon" onClick={onDelete}>
                            <Trash2 color="#ef4343" size={16} />
                        </Button>
                    </>
                )}
            </div>
        </div>
    )
}

function formatDelay(minutes: number): string {
    const days = Math.floor(minutes / (24 * 60))
    const hours = Math.floor((minutes % (24 * 60)) / 60)
    const mins = minutes % 60

    const parts = []
    if (days > 0) parts.push(`${days}d`)
    if (hours > 0) parts.push(`${hours}h`)
    if (mins > 0 || parts.length === 0) parts.push(`${mins}m`)
    return parts.join(" ")
}

function getCampaignStatusColor(status: string) {
    switch (status) {
        case "active": return "bg-green-100 text-green-700"
        case "paused": return "bg-yellow-100 text-yellow-700"
        case "completed": return "bg-blue-100 text-blue-700"
        default: return "bg-muted text-muted-foreground"
    }
}

function CampaignInfoCard({
    campaign,
    leadsCount,
    loading
}: {
    campaign: Campaign | null,
    leadsCount: number,
    loading: boolean
}) {
    if (loading) {
        return (
            <Card className="mb-6">
                <CardContent className="py-4 px-5">
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        {[1, 2, 3, 4].map(i => (
                            <div key={i} className="space-y-1">
                                <Skeleton className="h-3 w-full max-w-16" />
                                <Skeleton className="h-5 w-full max-w-24" />
                            </div>
                        ))}
                    </div>
                </CardContent>
            </Card>
        )
    }

    if (!campaign) return null

    return (
        <Card className="mb-6">
            <CardContent className="py-4 px-5">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div>
                        <p className="text-xs font-semibold uppercase tracking-wide text-foreground/70 mb-1">Status</p>
                        <span className={`px-2 py-1 rounded text-xs font-medium ${getCampaignStatusColor(campaign.status)}`}>
                            {campaign.status}
                        </span>
                    </div>
                    <div>
                        <p className="text-xs font-semibold uppercase tracking-wide text-foreground/70 mb-1">Leads</p>
                        <div className="flex items-center gap-1.5">
                            <Users size={14} className="text-muted-foreground" />
                            <span className="font-medium">{leadsCount}</span>
                        </div>
                    </div>
                    <div>
                        <p className="text-xs font-semibold uppercase tracking-wide text-foreground/70 mb-1">Follow-up Delay</p>
                        <div className="flex items-center gap-1.5">
                            <Clock size={14} className="text-muted-foreground" />
                            <span className="font-medium">{formatDelay(campaign.follow_up_delay_minutes)}</span>
                        </div>
                    </div>
                    <div>
                        <p className="text-xs font-semibold uppercase tracking-wide text-foreground/70 mb-1">Max Follow-ups</p>
                        <div className="flex items-center gap-1.5">
                            <RefreshCw size={14} className="text-muted-foreground" />
                            <span className="font-medium">{campaign.max_follow_ups}</span>
                        </div>
                    </div>
                </div>
                {campaign.goal && (
                    <div className="mt-3 pt-3 border-t">
                        <p className="text-xs font-semibold uppercase tracking-wide text-foreground/70 mb-1">Goal</p>
                        <p className="text-sm text-foreground">{campaign.goal}</p>
                    </div>
                )}
            </CardContent>
        </Card>
    )
}

function LeadsTable({ leads, campaignId }: { leads: Lead[], campaignId: string }) {
    return (
        <Table>
            <TableHeader className="sticky top-0 bg-background z-10 shadow-md">
                <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Company</TableHead>
                    <TableHead>Title</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Sequence</TableHead>
                </TableRow>
            </TableHeader>
            <TableBody>
                {leads.map((lead) => (
                    <TableRow
                        key={lead.id}
                        className="cursor-pointer hover:bg-muted/50 transition-colors"
                        onClick={() => window.location.href = `/campaigns/${campaignId}/leads/${lead.id}`}
                    >
                        <TableCell className="font-medium">
                            {lead.first_name} {lead.last_name}
                        </TableCell>
                        <TableCell>{lead.email}</TableCell>
                        <TableCell>{lead.company || "—"}</TableCell>
                        <TableCell>{lead.title || "—"}</TableCell>
                        <TableCell>
                            <span className={`px-2 py-1 rounded text-xs font-medium ${getStatusColor(lead.status)}`}>
                                {lead.status}
                            </span>
                        </TableCell>
                        <TableCell>{lead.current_sequence}</TableCell>
                    </TableRow>
                ))}
            </TableBody>
        </Table>
    )
}

function LeadsEmptyState() {
    return (
        <div className="text-center py-16 border border-dashed rounded-lg">
            <p className="text-muted-foreground">No leads yet. Add leads manually or import from CSV.</p>
        </div>
    )
}

export default function CampaignDetail() {
    const { id } = useParams<{ id: string }>()
    const [campaign, setCampaign] = useState<Campaign | null>(null)
    const [leads, setLeads] = useState<Lead[]>([])
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)
    const [showAddLead, setShowAddLead] = useState(false)
    const [showImportCSV, setShowImportCSV] = useState(false)
    const [searchQuery, setSearchQuery] = useState("")
    const [toggling, setToggling] = useState(false)
    const [showDelete, setShowDelete] = useState(false)

    const filteredLeads = useMemo(() => {
        if (!searchQuery.trim()) return leads
        const query = searchQuery.toLowerCase()
        return leads.filter(lead =>
            lead.first_name.toLowerCase().includes(query) ||
            lead.last_name.toLowerCase().includes(query) ||
            `${lead.first_name} ${lead.last_name}`.toLowerCase().includes(query) ||
            lead.email.toLowerCase().includes(query) ||
            (lead.company && lead.company.toLowerCase().includes(query)) ||
            (lead.title && lead.title.toLowerCase().includes(query)) ||
            lead.status.toLowerCase().includes(query) ||
            lead.current_sequence.toString().includes(query)
        )
    }, [leads, searchQuery])

    const fetchData = async () => {
        try {
            setLoading(true)
            const [campaignData, leadsData] = await Promise.all([
                get<Campaign>(`/campaigns/${id}`),
                get<Lead[]>(`/campaigns/${id}/leads`)
            ])
            setCampaign(campaignData)
            setLeads(leadsData)
            setError(null)
        } catch (err) {
            setError(err instanceof Error ? err.message : "Failed to fetch data")
        } finally {
            setLoading(false)
        }
    }

    useEffect(() => {
        if (id) fetchData()
    }, [id])

    const handleLeadsAdded = () => {
        setShowAddLead(false)
        setShowImportCSV(false)
        fetchData()
    }

    const handleToggleStatus = async () => {
        if (!id || !campaign || toggling) return // Prevent multiple clicks

        const action = campaign.status === "active" ? "stop" : "start"

        setToggling(true)

        try {
            const result = await patch<Campaign>(`/campaigns/${id}/status?action=${action}`, {})
            // Update with server response
            setCampaign(result)
            toast.success(`Campaign ${action === "start" ? "started" : "paused"} successfully`)
        } catch (err) {
            // Parse error message properly
            let errorMessage = "Failed to update campaign status"
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
            setToggling(false)
        }
    }

    if (error) {
        return (
            <div className="min-h-screen bg-background p-8">
                <div className="max-w-6xl mx-auto">
                    <div className="text-destructive bg-destructive/10 p-4 rounded-lg">{error}</div>
                </div>
            </div>
        )
    }

    return (
        <div className="min-h-screen bg-background p-8 flex flex-col">
            <div className="max-w-6xl mx-auto w-full flex flex-col flex-1">
                {/* Back link */}
                <Link to="/" className="inline-flex items-center gap-2 text-muted-foreground hover:text-foreground mb-6 flex-shrink-0">
                    <ArrowLeft size={16} />
                    Back to Campaigns
                </Link>

                {/* Header */}
                <div className="flex-shrink-0">
                    <CampaignDetailsHeader
                        loading={loading}
                        campaign={campaign}
                        setShowAddLead={setShowAddLead}
                        setShowImportCSV={setShowImportCSV}
                        onToggleStatus={handleToggleStatus}
                        toggling={toggling}
                        onDelete={() => setShowDelete(true)}
                    />
                </div>

                {/* Campaign Info Card */}
                <div className="flex-shrink-0">
                    <CampaignInfoCard campaign={campaign} leadsCount={leads.length} loading={loading} />
                </div>

                {loading ? (
                    <Skeleton className="h-9 w-32 mb-4" />
                ) : (
                    <h1 className="text-3xl font-bold pb-3">Leads</h1>
                )}

                {/* Search Bar */}
                <div className="flex-shrink-0 mb-4">
                    {loading ? (
                        <Skeleton className="h-10 w-full" />
                    ) : (
                        <div className="relative">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={18} />
                            <Input
                                placeholder="Search by name, email, company, title, status, or sequence..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="pl-10"
                            />
                        </div>
                    )}
                </div>

                {/* Leads Table - min 30vh, grows to fill remaining space */}
                {loading ? (
                    <div className="min-h-[40vh] max-h-[calc(100vh-20rem)] flex-1 border rounded-lg overflow-auto">
                        <LeadsTableSkeleton />
                    </div>
                ) : filteredLeads.length === 0 ? (
                    <LeadsEmptyState />
                ) : (
                    <div className="min-h-[40vh] max-h-[calc(100vh-20rem)] flex-1 border rounded-lg overflow-auto">
                        <LeadsTable leads={filteredLeads} campaignId={id!} />
                    </div>
                )}


                {/* Modals */}
                {id && (
                    <>
                        <AddLeadModal
                            open={showAddLead}
                            onClose={() => setShowAddLead(false)}
                            onSuccess={handleLeadsAdded}
                            campaignId={id}
                        />
                        <ImportCSVModal
                            open={showImportCSV}
                            onClose={() => setShowImportCSV(false)}
                            onSuccess={handleLeadsAdded}
                            campaignId={id}
                        />
                        <DeleteCampaignModal
                            open={showDelete}
                            onClose={() => setShowDelete(false)}
                            campaignId={id}
                            campaignName={campaign?.name || ""}
                        />
                    </>
                )}
            </div>
        </div>
    )
}