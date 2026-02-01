import { useState, useEffect } from "react"
import { get } from "@/lib/api"
import { Button } from "@/components/ui/button"
import { Plus } from "lucide-react"
import CreateCampaignModal from "@/components/CreateCampaignModal"

type Campaign = {
    id: string
    name: string
    sender_name: string
    sender_email: string
    status: string
    created_at: string
}

function CampaignHeader(
    { setShowModal }:
        { setShowModal: (show: boolean) => void }
) {
    return (
        <div className="flex justify-between items-center mb-8">
            <div>
                <h1 className="text-3xl font-bold">Campaigns</h1>
                <p className="text-muted-foreground mt-1">Manage your email outreach campaigns</p>
            </div>
            <Button onClick={() => setShowModal(true)} className="gap-2">
                <Plus size={18} />
                Create Campaign
            </Button>
        </div>
    )
}

function CampaignCard(
    { campaign }:
        { campaign: Campaign }
) {
    return (
        <div
            key={campaign.id}
            className="p-4 bg-card border rounded-lg hover:border-primary/50 transition-colors cursor-pointer"
        >
            <div className="flex justify-between items-start">
                <div>
                    <h3 className="font-semibold text-lg">{campaign.name}</h3>
                    <p className="text-muted-foreground text-sm">
                        {campaign.sender_name} &lt;{campaign.sender_email}&gt;
                    </p>
                </div>
                <span className={`px-2 py-1 rounded text-xs font-medium ${campaign.status === "active" ? "bg-green-100 text-green-700" :
                    campaign.status === "paused" ? "bg-yellow-100 text-yellow-700" :
                        campaign.status === "completed" ? "bg-blue-100 text-blue-700" :
                            "bg-muted text-muted-foreground"
                    }`}>
                    {campaign.status}
                </span>
            </div>
        </div>
    )
}

function CampaignContent(
    { campaigns, setShowModal }:
        {
            campaigns: Campaign[],
            setShowModal: (show: boolean) => void
        }
) {
    if (campaigns.length === 0) {
        return (
            <div className="text-center py-16 border border-dashed rounded-lg">
                <p className="text-muted-foreground mb-4">No campaigns yet</p>
                <Button onClick={() => setShowModal(true)} variant="outline" className="gap-2">
                    <Plus size={18} />
                    Create your first campaign
                </Button>
            </div>
        )
    }

    return (
        <div className="grid gap-4">
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

    const handleCampaignCreated = () => {
        setShowModal(false)
        fetchCampaigns()
    }

    return (
        <div className="min-h-screen bg-background p-8">
            <div className="max-w-6xl mx-auto">
                {/* Header */}
                <CampaignHeader setShowModal={setShowModal} />

                {/* Content */}
                {loading ? (
                    <div className="text-muted-foreground">Loading campaigns...</div>
                ) : error ? (
                    <div className="text-destructive bg-destructive/10 p-4 rounded-lg">{error}</div>
                ) : (
                    <CampaignContent campaigns={campaigns} setShowModal={setShowModal} />
                )}

                {/* Modal */}
                <CreateCampaignModal
                    open={showModal}
                    onClose={() => setShowModal(false)}
                    onSuccess={handleCampaignCreated}
                />
            </div>
        </div>
    )
}
