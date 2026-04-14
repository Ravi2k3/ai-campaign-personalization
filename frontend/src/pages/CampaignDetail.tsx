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
import { Input } from "@/components/ui/input"
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
    ArrowUpRight,
    Mail,
    Gauge,
    Target
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
            lead.status.toLowerCase().includes(query)
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
        if (!id || !campaign || toggling) return
        const action = campaign.status === "active" ? "stop" : "start"
        setToggling(true)
        try {
            const result = await patch<Campaign>(`/campaigns/${id}/status?action=${action}`, {})
            setCampaign(result)
            toast.success(`Campaign ${action === "start" ? "started" : "paused"}`)
        } catch (err) {
            toast.error(parseApiError(err))
        } finally {
            setToggling(false)
        }
    }

    if (error) {
        const is404 = error.toLowerCase().includes("not found") || error.toLowerCase().includes("404")
        return (
            <ErrorPage
                title={is404 ? "Campaign Not Found" : "Something Went Wrong"}
                message={error}
                statusCode={is404 ? 404 : 500}
            />
        )
    }

    const canStart = (campaign?.status === "draft" || campaign?.status === "paused") && leads.length > 0
    const canStop = campaign?.status === "active"
    const showToggle = campaign?.status === "draft" || campaign?.status === "paused" || campaign?.status === "active"
    const isCompleted = campaign?.status === "completed"

    const hasLeads = stats ? stats.emails_target > 0 : false
    const campaignProgress = hasLeads && stats
        ? Math.min(100, Math.round((stats.emails_sent / stats.emails_target) * 100))
        : 0
    const rateLimitProgress = stats
        ? Math.min(100, Math.round((stats.emails_in_window / stats.rate_limit) * 100))
        : 0
    const isRateLimited = stats ? stats.rate_limit_remaining === 0 : false

    return (
        <div className="px-6 sm:px-8 py-8">
            <div className="max-w-6xl mx-auto space-y-6">

                {/* ── Header ───────────────────────────────────────── */}
                <div className="flex flex-col sm:flex-row justify-between items-start gap-4">
                    <div className="min-w-0 flex-1">
                        {loading ? (
                            <>
                                <Skeleton className="h-9 w-64 mb-2" />
                                <Skeleton className="h-4 w-48" />
                            </>
                        ) : (
                            <>
                                <div className="flex items-center gap-3 mb-1">
                                    <h1 className="heading-serif text-4xl tracking-tight truncate">
                                        {campaign?.name}
                                    </h1>
                                    {campaign && (() => {
                                        const s = getCampaignStatus(campaign.status)
                                        return <Badge variant={s.variant} className={s.className}>{s.label}</Badge>
                                    })()}
                                </div>
                                <p className="text-sm text-muted-foreground">
                                    {campaign?.sender_name} &middot; {campaign?.sender_email}
                                </p>
                            </>
                        )}
                    </div>

                    {!loading && (
                        <div className="flex items-center gap-2 flex-shrink-0">
                            {showToggle && (
                                <TooltipProvider>
                                    <Tooltip>
                                        <TooltipTrigger asChild>
                                            <span>
                                                <Button
                                                    variant={canStart ? "default" : "outline"}
                                                    size="sm"
                                                    onClick={handleToggleStatus}
                                                    disabled={toggling || (!canStart && !canStop)}
                                                    className="gap-1.5"
                                                >
                                                    {canStop ? <Pause size={14} /> : <Play size={14} />}
                                                    {canStop
                                                        ? (toggling ? "Pausing..." : "Pause")
                                                        : (toggling ? "Starting..." : "Start")}
                                                </Button>
                                            </span>
                                        </TooltipTrigger>
                                        {!canStart && !canStop && (
                                            <TooltipContent>Add leads to start campaign</TooltipContent>
                                        )}
                                    </Tooltip>
                                </TooltipProvider>
                            )}
                            {!isCompleted && (
                                <>
                                    <Button variant="outline" size="sm" onClick={() => setShowImportCSV(true)} className="gap-1.5">
                                        <Upload size={14} /> Import
                                    </Button>
                                    <Button variant="outline" size="sm" onClick={() => setShowAddLead(true)} className="gap-1.5">
                                        <UserPlus size={14} /> Add Lead
                                    </Button>
                                </>
                            )}
                            <Button variant="ghost" size="icon" onClick={() => setShowDelete(true)} className="text-muted-foreground hover:text-destructive">
                                <Trash2 size={14} />
                            </Button>
                        </div>
                    )}
                </div>

                {/* ── Stats Row ─────────────────────────────────────── */}
                {loading ? (
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                        {[1, 2, 3, 4].map(i => (
                            <Skeleton key={i} className="h-20 rounded-xl" />
                        ))}
                    </div>
                ) : campaign && (
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                        <div className="bg-card border rounded-xl p-4">
                            <div className="flex items-center gap-2 text-muted-foreground mb-2">
                                <Users size={13} />
                                <span className="text-[11px] font-medium uppercase tracking-wide">Leads</span>
                            </div>
                            <p className="text-2xl font-semibold">{leads.length}</p>
                        </div>
                        <div className="bg-card border rounded-xl p-4">
                            <div className="flex items-center gap-2 text-muted-foreground mb-2">
                                <Clock size={13} />
                                <span className="text-[11px] font-medium uppercase tracking-wide">Follow-up Delay</span>
                            </div>
                            <p className="text-2xl font-semibold">{formatDelay(campaign.follow_up_delay_minutes)}</p>
                        </div>
                        <div className="bg-card border rounded-xl p-4">
                            <div className="flex items-center gap-2 text-muted-foreground mb-2">
                                <RefreshCw size={13} />
                                <span className="text-[11px] font-medium uppercase tracking-wide">Max Follow-ups</span>
                            </div>
                            <p className="text-2xl font-semibold">{campaign.max_follow_ups}</p>
                        </div>
                        <div className="bg-card border rounded-xl p-4">
                            <div className="flex items-center gap-2 text-muted-foreground mb-2">
                                <Mail size={13} />
                                <span className="text-[11px] font-medium uppercase tracking-wide">Emails Sent</span>
                            </div>
                            <p className="text-2xl font-semibold">
                                {stats ? stats.emails_sent : 0}
                                <span className="text-sm font-normal text-muted-foreground">
                                    {stats ? ` / ${stats.emails_target}` : ""}
                                </span>
                            </p>
                        </div>
                    </div>
                )}

                {/* ── Progress Bars ─────────────────────────────────── */}
                {!loading && stats && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="bg-card border rounded-xl p-4 space-y-2">
                            <div className="flex items-center justify-between text-[13px]">
                                <div className="flex items-center gap-2 text-muted-foreground">
                                    <Target size={13} />
                                    <span className="font-medium">Campaign Progress</span>
                                </div>
                                <span className="text-muted-foreground">
                                    {hasLeads ? `${campaignProgress}%` : "No leads"}
                                </span>
                            </div>
                            <div className="h-2 bg-muted rounded-full overflow-hidden">
                                <div
                                    className="h-full rounded-full transition-all bg-emerald-500"
                                    style={{ width: `${campaignProgress}%` }}
                                />
                            </div>
                        </div>
                        <div className="bg-card border rounded-xl p-4 space-y-2">
                            <div className="flex items-center justify-between text-[13px]">
                                <div className="flex items-center gap-2 text-muted-foreground">
                                    <Gauge size={13} />
                                    <span className="font-medium">Sending Quota</span>
                                </div>
                                <span className="text-muted-foreground">
                                    {isCompleted
                                        ? "Done"
                                        : `${stats.emails_in_window} / ${stats.rate_limit}`}
                                </span>
                            </div>
                            <div className="h-2 bg-muted rounded-full overflow-hidden">
                                <div
                                    className={`h-full rounded-full transition-all ${
                                        isCompleted ? "bg-muted-foreground/30"
                                        : isRateLimited ? "bg-red-500"
                                        : rateLimitProgress > 80 ? "bg-yellow-500"
                                        : "bg-emerald-500"
                                    }`}
                                    style={{ width: `${isCompleted ? 100 : rateLimitProgress}%` }}
                                />
                            </div>
                            {!isCompleted && isRateLimited && stats.rate_limit_resets_at && (
                                <p className="text-[11px] text-red-500 font-medium">
                                    Paused until {(() => {
                                        const t = formatTime(stats.rate_limit_resets_at)
                                        return t ? `${t.time} ${t.timezone}` : "soon"
                                    })()}
                                </p>
                            )}
                        </div>
                    </div>
                )}

                {/* ── Goal ──────────────────────────────────────────── */}
                {!loading && campaign?.goal && (
                    <div className="bg-card border rounded-xl p-4">
                        <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground mb-1.5">Campaign Goal</p>
                        <p className="text-[14px] leading-relaxed">{campaign.goal}</p>
                    </div>
                )}

                {/* ── Leads Section ─────────────────────────────────── */}
                <div className="space-y-3">
                    <div className="flex items-center justify-between">
                        <h2 className="text-lg font-semibold">Leads</h2>
                        {!loading && <span className="text-[12px] text-muted-foreground">{filteredLeads.length} total</span>}
                    </div>

                    {!loading && (
                        <div className="relative">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={15} />
                            <Input
                                placeholder="Search leads..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="pl-9 h-9 text-sm"
                            />
                        </div>
                    )}

                    {loading ? (
                        <div className="border rounded-xl overflow-hidden">
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>Name</TableHead>
                                        <TableHead>Email</TableHead>
                                        <TableHead>Company</TableHead>
                                        <TableHead>Status</TableHead>
                                        <TableHead>Seq</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {[1, 2, 3, 4, 5].map(i => (
                                        <TableRow key={i}>
                                            <TableCell><Skeleton className="h-4 w-28" /></TableCell>
                                            <TableCell><Skeleton className="h-4 w-36" /></TableCell>
                                            <TableCell><Skeleton className="h-4 w-20" /></TableCell>
                                            <TableCell><Skeleton className="h-4 w-14" /></TableCell>
                                            <TableCell><Skeleton className="h-4 w-6" /></TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        </div>
                    ) : filteredLeads.length === 0 ? (
                        <div className="text-center py-16 border border-dashed rounded-xl">
                            <p className="text-muted-foreground text-sm">
                                {leads.length === 0 ? "No leads yet. Add leads manually or import from CSV." : "No leads match your search."}
                            </p>
                        </div>
                    ) : (
                        <div className="border rounded-xl overflow-auto max-h-[50vh]">
                            <Table>
                                <TableHeader className="sticky top-0 bg-card z-10">
                                    <TableRow>
                                        <TableHead>Name</TableHead>
                                        <TableHead>Email</TableHead>
                                        <TableHead>Company</TableHead>
                                        <TableHead>Status</TableHead>
                                        <TableHead>Seq</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {filteredLeads.map(lead => {
                                        const s = getLeadStatus(lead.status)
                                        return (
                                            <TableRow
                                                key={lead.id}
                                                className="cursor-pointer group"
                                                onClick={() => window.location.href = `/campaigns/${id}/leads/${lead.id}`}
                                            >
                                                <TableCell>
                                                    <span className="inline-flex items-center gap-1.5 font-medium text-[13px] group-hover:text-primary transition-colors">
                                                        {lead.first_name} {lead.last_name}
                                                        <ArrowUpRight size={12} className="opacity-0 group-hover:opacity-100 transition-opacity" />
                                                    </span>
                                                </TableCell>
                                                <TableCell className="text-[13px] text-muted-foreground max-w-[200px]">
                                                    <span className="truncate block" title={lead.email}>{lead.email}</span>
                                                </TableCell>
                                                <TableCell className="text-[13px]">{lead.company || "—"}</TableCell>
                                                <TableCell>
                                                    <Badge variant={s.variant} className={`${s.className} text-[11px]`}>{s.label}</Badge>
                                                </TableCell>
                                                <TableCell className="text-[13px] text-muted-foreground">{lead.current_sequence}</TableCell>
                                            </TableRow>
                                        )
                                    })}
                                </TableBody>
                            </Table>
                        </div>
                    )}
                </div>

                {/* ── Modals ────────────────────────────────────────── */}
                {id && (
                    <>
                        <AddLeadModal open={showAddLead} onClose={() => setShowAddLead(false)} onSuccess={handleLeadsAdded} campaignId={id} />
                        <ImportCSVModal open={showImportCSV} onClose={() => setShowImportCSV(false)} onSuccess={handleLeadsAdded} campaignId={id} />
                        <DeleteCampaignModal open={showDelete} onClose={() => setShowDelete(false)} campaignId={id} campaignName={campaign?.name || ""} />
                    </>
                )}
            </div>
        </div>
    )
}
