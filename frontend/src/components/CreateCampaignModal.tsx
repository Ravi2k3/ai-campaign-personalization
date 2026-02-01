import { useState } from "react"
import { post } from "@/lib/api"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog"

type Props = {
    open: boolean
    onClose: () => void
    onSuccess: () => void
}

export default function CreateCampaignModal({ open, onClose, onSuccess }: Props) {
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [form, setForm] = useState({
        name: "",
        sender_name: "",
        sender_email: "",
        goal: "",
        max_follow_ups: 3,
    })

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        setLoading(true)
        setError(null)

        try {
            await post("/campaigns", form)
            setForm({ name: "", sender_name: "", sender_email: "", goal: "", max_follow_ups: 3 })
            onSuccess()
        } catch (err) {
            setError(err instanceof Error ? err.message : "Failed to create campaign")
        } finally {
            setLoading(false)
        }
    }

    return (
        <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Create Campaign</DialogTitle>
                    <DialogDescription>
                        Set up a new email outreach campaign
                    </DialogDescription>
                </DialogHeader>

                <form onSubmit={handleSubmit} className="space-y-4">
                    <div className="space-y-2">
                        <Label htmlFor="name">Campaign Name</Label>
                        <Input
                            id="name"
                            required
                            value={form.name}
                            onChange={(e) => setForm({ ...form, name: e.target.value })}
                            placeholder="Q1 Outreach"
                        />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label htmlFor="sender_name">Sender Name</Label>
                            <Input
                                id="sender_name"
                                required
                                value={form.sender_name}
                                onChange={(e) => setForm({ ...form, sender_name: e.target.value })}
                                placeholder="John Doe"
                            />
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="sender_email">Reply-To Email</Label>
                            <Input
                                id="sender_email"
                                type="email"
                                required
                                value={form.sender_email}
                                onChange={(e) => setForm({ ...form, sender_email: e.target.value })}
                                placeholder="john@company.com"
                            />
                        </div>
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="max_follow_ups">Max Follow-ups</Label>
                        <Input
                            id="max_follow_ups"
                            type="number"
                            min={1}
                            max={10}
                            value={form.max_follow_ups}
                            onChange={(e) => setForm({ ...form, max_follow_ups: parseInt(e.target.value) || 3 })}
                        />
                        <p className="text-xs text-muted-foreground">
                            Number of follow-up emails before stopping (1-10)
                        </p>
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="goal">Campaign Goal (Optional)</Label>
                        <textarea
                            id="goal"
                            value={form.goal}
                            onChange={(e) => setForm({ ...form, goal: e.target.value })}
                            className="flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                            placeholder="Schedule demos with enterprise leads..."
                        />
                    </div>

                    {error && (
                        <div className="text-sm text-destructive">{error}</div>
                    )}

                    <DialogFooter>
                        <Button type="button" variant="outline" onClick={onClose}>
                            Cancel
                        </Button>
                        <Button type="submit" disabled={loading}>
                            {loading ? "Creating..." : "Create Campaign"}
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    )
}
