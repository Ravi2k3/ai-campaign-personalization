import { useState, useEffect, useMemo } from "react"
import { Link } from "react-router-dom"
import { get } from "@/lib/api"
import { getCampaignStatus } from "@/lib/status"
import { useBreadcrumbs } from "@/contexts/BreadcrumbContext"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Alert, AlertDescription } from "@/components/ui/alert"
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle
} from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { Plus, Search, Mail, Users, AlertCircle } from "lucide-react"
import CreateCampaignModal from "@/components/CreateCampaignModal"

type Campaign = {
    id: string
    name: string
    sender_name: string
    sender_email: string
    goal: string | null
    max_follow_ups: number
    status: string
    created_at: string
}

function CampaignCard({ campaign }: { campaign: Campaign }) {
    const status = getCampaignStatus(campaign.status)

    return (
        <Link to={`/campaigns/${campaign.id}`}>
            <Card className="hover:border-primary/50 transition-colors cursor-pointer h-full">
                <CardHeader className="pb-2">
                    <div className="flex justify-between items-start">
                        <CardTitle className="text-lg">{campaign.name}</CardTitle>
                        <Badge variant={status.variant} className={status.className}>
                            {status.label}
                        </Badge>
                    </div>
                    <CardDescription className="line-clamp-2">
                        {campaign.goal || "No goal specified"}
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-2">
                    <div className="flex items-start gap-2 text-sm text-muted-foreground min-w-0">
                        <Mail size={14} className="mt-1 flex-shrink-0" />
                        <div className="flex flex-col sm:flex-row sm:gap-1 min-w-0 flex-1">
                            <span className="truncate" title={campaign.sender_name}>{campaign.sender_name}</span>
                            <div className="flex min-w-0 text-muted-foreground/80" title={`<${campaign.sender_email}>`}>
                                <span>&lt;</span>
                                <span className="truncate">{campaign.sender_email}</span>
                                <span>&gt;</span>
                            </div>
                        </div>
                    </div>
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Users size={14} />
                        <span>Max {campaign.max_follow_ups} follow-ups</span>
                    </div>
                </CardContent>
            </Card>
        </Link>
    )
}

function CampaignSkeleton() {
    return (
        <Card>
            <CardHeader className="pb-2">
                <div className="flex justify-between items-start">
                    <Skeleton className="h-6 w-32" />
                    <Skeleton className="h-5 w-16" />
                </div>
                <Skeleton className="h-4 w-full mt-2" />
            </CardHeader>
            <CardContent className="space-y-2">
                <Skeleton className="h-4 w-48" />
                <Skeleton className="h-4 w-32" />
            </CardContent>
        </Card>
    )
}

function CampaignContent({
    campaigns,
    setShowModal,
    loading
}: {
    campaigns: Campaign[]
    setShowModal: (show: boolean) => void
    loading: boolean
}) {
    if (loading) {
        return (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <CampaignSkeleton />
                <CampaignSkeleton />
                <CampaignSkeleton />
                <CampaignSkeleton />
            </div>
        )
    }

    if (campaigns.length === 0) {
        return (
            <div className="text-center py-16 border border-dashed border-muted-foreground/50 rounded-lg">
                <p className="text-muted-foreground mb-4">No campaigns found</p>
                <Button onClick={() => setShowModal(true)} variant="outline" className="gap-2">
                    <Plus size={18} />
                    Create a campaign
                </Button>
            </div>
        )
    }

    return (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {campaigns.map((campaign) => (
                <CampaignCard key={campaign.id} campaign={campaign} />
            ))}
        </div>
    )
}

export default function Campaigns() {
    const [campaigns, setCampaigns] = useState<Campaign[]>([])
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)
    const [showModal, setShowModal] = useState(false)
    const [searchQuery, setSearchQuery] = useState("")

    useBreadcrumbs([{ label: "Campaigns" }])

    const fetchCampaigns = async () => {
        try {
            setLoading(true)
            const data = await get<Campaign[]>("/campaigns")
            setCampaigns(data)
            setError(null)
        } catch (err) {
            setError(err instanceof Error ? err.message : "Failed to fetch campaigns")
        } finally {
            setLoading(false)
        }
    }

    useEffect(() => {
        fetchCampaigns()
    }, [])

    const filteredCampaigns = useMemo(() => {
        if (!searchQuery.trim()) return campaigns
        const query = searchQuery.toLowerCase()
        return campaigns.filter(c =>
            c.name.toLowerCase().includes(query) ||
            c.sender_name.toLowerCase().includes(query) ||
            c.sender_email.toLowerCase().includes(query) ||
            c.status.toLowerCase().includes(query) ||
            (c.goal && c.goal.toLowerCase().includes(query))
        )
    }, [campaigns, searchQuery])

    const handleCampaignCreated = () => {
        setShowModal(false)
        fetchCampaigns()
    }

    return (
        <div className="flex flex-col h-full">
            <div className="sticky top-0 z-10 bg-background px-8 pt-6 pb-4">
                <div className="max-w-6xl mx-auto space-y-4">
                    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 sm:gap-0">
                        <div>
                            <h1 className="text-3xl font-bold">Campaigns</h1>
                            <p className="text-muted-foreground mt-1">Manage your email outreach campaigns</p>
                        </div>
                        <Button onClick={() => setShowModal(true)} className="gap-2 w-full sm:w-auto">
                            <Plus size={18} />
                            Create Campaign
                        </Button>
                    </div>
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={18} />
                        <Input
                            placeholder="Search by name, goal, sender, or status..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="pl-10"
                        />
                    </div>
                </div>
            </div>

            <div className="flex-1 overflow-y-auto px-8 py-6">
                <div className="max-w-6xl mx-auto">
                    {error ? (
                        <Alert variant="destructive">
                            <AlertCircle className="h-4 w-4" />
                            <AlertDescription>{error}</AlertDescription>
                        </Alert>
                    ) : (
                        <CampaignContent
                            campaigns={filteredCampaigns}
                            setShowModal={setShowModal}
                            loading={loading}
                        />
                    )}
                </div>
            </div>

            <CreateCampaignModal
                open={showModal}
                onClose={() => setShowModal(false)}
                onSuccess={handleCampaignCreated}
            />
        </div>
    )
}
