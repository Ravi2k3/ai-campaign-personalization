import { useState, useEffect, useMemo } from "react"
import { useParams } from "react-router-dom"
import { get, patch } from "@/lib/api"
import { formatTime } from "@/lib/utils"
import { getCampaignStatus, getLeadStatus } from "@/lib/status"
import { parseApiError } from "@/lib/errors"
import { useBreadcrumbs } from "@/contexts/BreadcrumbContext"
import { toast } from "sonner"
import ErrorPage from "./ErrorPage"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Progress } from "@/components/ui/progress"
import {
    Tooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger,
} from "@/components/ui/tooltip"
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table"
import {
    Upload,
    UserPlus,
    Clock,
    RefreshCw,
    Users,
    Search,
    Play,
    Pause,
    Trash2,
    ExternalLink,
    Mail,
    Gauge
} from "lucide-react"
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

type CampaignStats = {
    emails_sent: number
    emails_target: number
    emails_in_window: number
    rate_limit: number
    rate_limit_window_minutes: number
    rate_limit_remaining: number
    rate_limit_resets_at: string | null
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
    leadsCount,
    setShowAddLead,
    setShowImportCSV,
    onToggleStatus,
    toggling,
    onDelete
}: {
    loading: boolean
    campaign: Campaign | null
    leadsCount: number
    setShowAddLead: (show: boolean) => void
    setShowImportCSV: (show: boolean) => void
    onToggleStatus: () => void
    toggling: boolean
    onDelete: () => void
}) {
    const canStart = (campaign?.status === "draft" || campaign?.status === "paused") && leadsCount > 0
    const canStop = campaign?.status === "active"
    const showToggle = (campaign?.status === "draft" || campaign?.status === "paused" || campaign?.status === "active")

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
                        <h1 className="text-3xl font-bold break-words">{campaign?.name}</h1>
                        <div className="flex flex-wrap items-center gap-1 text-muted-foreground mt-1">
                            <span className="truncate max-w-full" title={campaign?.sender_name}>{campaign?.sender_name}</span>
                            <div className="flex min-w-0" title={`<${campaign?.sender_email}>`}>
                                <span>&lt;</span>
                                <span className="truncate max-w-[200px] sm:max-w-[300px]">{campaign?.sender_email}</span>
                                <span>&gt;</span>
                            </div>
                        </div>
                    </>
                )}
            </div>
            <div className="grid grid-cols-2 gap-2 w-full sm:flex sm:w-auto sm:flex-shrink-0">
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
                            <TooltipProvider>
                                <Tooltip>
                                    <TooltipTrigger asChild>
                                        <span tabIndex={!canStart && !canStop ? 0 : undefined} className="order-1 sm:order-none col-span-1">
                                            <Button
                                                variant={canStart ? "default" : canStop ? "outline" : "secondary"}
                                                onClick={onToggleStatus}
                                                disabled={toggling || (!canStart && !canStop)}
                                                className="gap-2 w-full sm:w-auto"
                                            >
                                                {canStop ? (
                                                    <>
                                                        <Pause size={16} />
                                                        {toggling ? "Pausing..." : "Pause"}
                                                    </>
                                                ) : (
                                                    <>
                                                        <Play size={16} />
                                                        {toggling ? "Starting..." : "Start"}
                                                    </>
                                                )}
                                            </Button>
                                        </span>
                                    </TooltipTrigger>
                                    {!canStart && !canStop && (
                                        <TooltipContent>
                                            <p>Add leads to start campaign</p>
                                        </TooltipContent>
                                    )}
                                </Tooltip>
                            </TooltipProvider>
                        )}
                        {campaign?.status !== 'completed' && (
                            <>
                                <Button variant="outline" onClick={() => setShowImportCSV(true)} className="gap-2 order-3 sm:order-none w-full sm:w-auto col-span-1">
                                    <Upload size={16} />
                                    Import CSV
                                </Button>
                                <Button onClick={() => setShowAddLead(true)} className="gap-2 order-4 sm:order-none w-full sm:w-auto col-span-1">
                                    <UserPlus size={16} />
                                    Add Lead
                                </Button>
                            </>
                        )}
                        <Button variant="outline" size="icon" onClick={onDelete} className="order-2 sm:order-none justify-self-end sm:justify-self-auto col-span-1">
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


function CampaignProgressCard({
    stats,
    loading,
    campaignStatus
}: {
    stats: CampaignStats | null
    loading: boolean
    campaignStatus: string | undefined
}) {
    if (loading) {
        return (
            <Card className="mb-6">
                <CardContent className="py-4 px-5">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        {[1, 2].map(i => (
                            <div key={i} className="space-y-2">
                                <Skeleton className="h-4 w-32" />
                                <Skeleton className="h-2 w-full" />
                                <Skeleton className="h-3 w-24" />
                            </div>
                        ))}
                    </div>
                </CardContent>
            </Card>
        )
    }

    if (!stats) return null

    const hasLeads = stats.emails_target > 0
    const campaignProgress = hasLeads
        ? Math.min(100, Math.round((stats.emails_sent / stats.emails_target) * 100))
        : 0
    const rateLimitProgress = Math.min(100, Math.round((stats.emails_in_window / stats.rate_limit) * 100))
    const isRateLimited = stats.rate_limit_remaining === 0

    return (
        <Card className="mb-6">
            <CardContent className="py-4 px-5">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* Campaign Progress */}
                    <div className="space-y-2">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                <Mail size={14} className="text-muted-foreground" />
                                <span className="text-sm font-medium">Campaign Progress</span>
                            </div>
                            <span className="text-sm text-muted-foreground">
                                {hasLeads ? `${stats.emails_sent} / ${stats.emails_target} emails` : "No leads yet"}
                            </span>
                        </div>
                        <Progress value={campaignProgress} className="h-2" />
                        <p className="text-xs text-muted-foreground">
                            {hasLeads ? `${campaignProgress}% complete` : "Add leads to start"}
                        </p>
                    </div>

                    {/* Sending Quota */}
                    <div className="space-y-2">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                <Gauge size={14} className="text-muted-foreground" />
                                <span className="text-sm font-medium">Sending Quota</span>
                            </div>
                            <span className="text-sm text-muted-foreground">
                                {campaignStatus === "completed" ? "—" : `${stats.emails_in_window} of ${stats.rate_limit} used`}
                            </span>
                        </div>
                        <Progress
                            value={campaignStatus === "completed" ? 100 : rateLimitProgress}
                            className="h-2"
                            indicatorClassName={
                                campaignStatus === "completed"
                                    ? undefined
                                    : isRateLimited
                                        ? "bg-red-500"
                                        : rateLimitProgress > 80
                                            ? "bg-yellow-500"
                                            : undefined
                            }
                        />
                        <p className={`text-xs ${campaignStatus === "completed"
                            ? "text-muted-foreground"
                            : isRateLimited
                                ? "text-red-500 font-medium"
                                : "text-muted-foreground"
                            }`}>
                            {campaignStatus === "completed"
                                ? "Campaign completed ✓"
                                : isRateLimited
                                    ? (() => {
                                        const resetTime = formatTime(stats.rate_limit_resets_at)
                                        return resetTime
                                            ? <>Paused until {resetTime.time} <span className="text-red-400 font-normal">{resetTime.timezone}</span></>
                                            : "Paused - resuming soon"
                                    })()
                                    : stats.rate_limit_remaining === stats.rate_limit
                                        ? "Ready to send"
                                        : `${stats.rate_limit_remaining} more email${stats.rate_limit_remaining === 1 ? "" : "s"} available`}
                        </p>
                    </div>
                </div>
            </CardContent>
        </Card>
    )
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
                        {(() => { const s = getCampaignStatus(campaign.status); return (
                            <Badge variant={s.variant} className={s.className}>{s.label}</Badge>
                        ) })()}
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
                        className="cursor-pointer hover:bg-muted/50 transition-colors group"
                        onClick={() => window.location.href = `/campaigns/${campaignId}/leads/${lead.id}`}
                    >
                        <TableCell className="font-medium">
                            <span className="inline-flex items-center gap-2 text-primary group-hover:underline">
                                <ExternalLink size={14} className="text-muted-foreground group-hover:text-primary transition-colors" />
                                {lead.first_name} {lead.last_name}
                            </span>
                        </TableCell>
                        <TableCell className="max-w-[200px]">
                            <div className="truncate" title={lead.email}>{lead.email}</div>
                        </TableCell>
                        <TableCell>{lead.company || "—"}</TableCell>
                        <TableCell>{lead.title || "—"}</TableCell>
                        <TableCell>
                            {(() => { const s = getLeadStatus(lead.status); return (
                                <Badge variant={s.variant} className={s.className}>{s.label}</Badge>
                            ) })()}
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
    const [stats, setStats] = useState<CampaignStats | null>(null)
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)
    const [showAddLead, setShowAddLead] = useState(false)
    const [showImportCSV, setShowImportCSV] = useState(false)
    const [searchQuery, setSearchQuery] = useState("")
    const [toggling, setToggling] = useState(false)
    const [showDelete, setShowDelete] = useState(false)

    useBreadcrumbs([
        { label: "Campaigns", href: "/" },
        { label: campaign?.name || "Loading..." },
    ])

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
            const [campaignData, leadsData, statsData] = await Promise.all([
                get<Campaign>(`/campaigns/${id}`),
                get<Lead[]>(`/campaigns/${id}/leads`),
                get<CampaignStats>(`/campaigns/${id}/stats`)
            ])
            setCampaign(campaignData)
            setLeads(leadsData)
            setStats(statsData)
            setError(null)
        } catch (err) {
            setError(parseApiError(err))
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
            toast.error(parseApiError(err))
        } finally {
            setToggling(false)
        }
    }

    if (error) {
        // Determine if it's a 404 or 500 error
        const is404 = error.toLowerCase().includes("not found") || error.toLowerCase().includes("404")
        return (
            <ErrorPage
                title={is404 ? "Campaign Not Found" : "Something Went Wrong"}
                message={error}
                statusCode={is404 ? 404 : 500}
            />
        )
    }

    return (
        <div className="min-h-screen bg-background p-8 flex flex-col">
            <div className="max-w-6xl mx-auto w-full flex flex-col flex-1">
                {/* Header */}
                <div className="flex-shrink-0">
                    <CampaignDetailsHeader
                        loading={loading}
                        campaign={campaign}
                        leadsCount={leads.length}
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

                {/* Campaign Progress Card */}
                <div className="flex-shrink-0">
                    <CampaignProgressCard stats={stats} loading={loading} campaignStatus={campaign?.status} />
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