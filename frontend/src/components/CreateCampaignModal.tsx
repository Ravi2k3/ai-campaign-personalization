import { useState, useMemo } from "react"
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

export default function CreateCampaignModal({
    open,
    onClose,
    onSuccess
}: {
    open: boolean
    onClose: () => void
    onSuccess: () => void
}) {
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [fieldErrors, setFieldErrors] = useState<{ max_follow_ups?: string }>({})
    const [form, setForm] = useState({
        name: "",
        sender_name: "",
        sender_email: "",
        goal: "",
        max_follow_ups: 3,
    })

    // Follow-up delay split into days, hours, minutes
    const [delayDays, setDelayDays] = useState(2)
    const [delayHours, setDelayHours] = useState(0)
    const [delayMinutes, setDelayMinutes] = useState(0)

    // Compute total minutes from D/H/M
    const followUpDelayMinutes = useMemo(() => {
        return (delayDays * 24 * 60) + (delayHours * 60) + delayMinutes
    }, [delayDays, delayHours, delayMinutes])

    const validateMaxFollowUps = (value: number) => {
        if (value < 1 || value > 10) {
            setFieldErrors({ ...fieldErrors, max_follow_ups: "Must be between 1 and 10" })
            return false
        }
        setFieldErrors({ ...fieldErrors, max_follow_ups: undefined })
        return true
    }

    const handleMaxFollowUpsChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const value = parseInt(e.target.value) || 0
        setForm({ ...form, max_follow_ups: value })
        validateMaxFollowUps(value)
    }

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()

        if (!validateMaxFollowUps(form.max_follow_ups)) {
            return
        }

        setLoading(true)
        setError(null)

        try {
            await post("/campaigns", {
                ...form,
                follow_up_delay_minutes: followUpDelayMinutes
            })
            setForm({ name: "", sender_name: "", sender_email: "", goal: "", max_follow_ups: 3 })
            setDelayDays(2)
            setDelayHours(0)
            setDelayMinutes(0)
            setFieldErrors({})
            onSuccess()
        } catch (err) {
            setError(err instanceof Error ? err.message : "Failed to create campaign")
        } finally {
            setLoading(false)
        }
    }

    const hasFieldErrors = Object.values(fieldErrors).some(Boolean)

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
                        <Label>Follow-up Delay</Label>
                        <div className="grid grid-cols-3 gap-2">
                            <div className="relative">
                                <Input
                                    type="number"
                                    min={0}
                                    value={delayDays}
                                    onChange={(e) => setDelayDays(Math.max(0, parseInt(e.target.value) || 0))}
                                    className="pr-8"
                                />
                                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">D</span>
                            </div>
                            <div className="relative">
                                <Input
                                    type="number"
                                    min={0}
                                    max={23}
                                    value={delayHours}
                                    onChange={(e) => setDelayHours(Math.min(23, Math.max(0, parseInt(e.target.value) || 0)))}
                                    className="pr-8"
                                />
                                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">H</span>
                            </div>
                            <div className="relative">
                                <Input
                                    type="number"
                                    min={0}
                                    max={59}
                                    value={delayMinutes}
                                    onChange={(e) => setDelayMinutes(Math.min(59, Math.max(0, parseInt(e.target.value) || 0)))}
                                    className="pr-8"
                                />
                                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">M</span>
                            </div>
                        </div>
                        <p className="text-xs text-muted-foreground">
                            Wait time between follow-up emails
                        </p>
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="max_follow_ups">Max Follow-ups</Label>
                        <Input
                            id="max_follow_ups"
                            type="number"
                            value={form.max_follow_ups}
                            onChange={handleMaxFollowUpsChange}
                            className={fieldErrors.max_follow_ups ? "border-destructive" : ""}
                        />
                        {fieldErrors.max_follow_ups ? (
                            <p className="text-xs text-destructive">{fieldErrors.max_follow_ups}</p>
                        ) : (
                            <p className="text-xs text-muted-foreground">
                                Number of follow-up emails before stopping (1-10)
                            </p>
                        )}
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
                        <Button type="submit" disabled={loading || hasFieldErrors}>
                            {loading ? "Creating..." : "Create Campaign"}
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    )
}