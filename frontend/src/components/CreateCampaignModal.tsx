import { useState, useMemo } from "react"
import { post } from "@/lib/api"
import { toast } from "sonner"
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
    const [fieldErrors, setFieldErrors] = useState<{
        max_follow_ups?: string
        delay_days?: string
        delay_hours?: string
        delay_minutes?: string
        delay_total?: string
        name?: string
        sender_name?: string
        goal?: string
    }>({})
    const [form, setForm] = useState({
        name: "",
        sender_name: "",
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
            setFieldErrors(prev => ({ ...prev, max_follow_ups: "Must be between 1 and 10" }))
            return false
        }
        setFieldErrors(prev => ({ ...prev, max_follow_ups: undefined }))
        return true
    }

    const validateDelayFields = (days: number, hours: number, minutes: number) => {
        const errors: typeof fieldErrors = {}

        if (days < 0 || days > 30) {
            errors.delay_days = "Days must be between 0 and 30"
        }
        if (hours < 0 || hours > 23) {
            errors.delay_hours = "Hours must be between 0 and 23"
        }
        if (minutes < 0 || minutes > 59) {
            errors.delay_minutes = "Minutes must be between 0 and 59"
        }

        const totalMinutes = (days * 24 * 60) + (hours * 60) + minutes
        if (totalMinutes < 1) {
            errors.delay_total = "Total delay must be at least 1 minute"
        }

        setFieldErrors(prev => ({
            ...prev,
            delay_days: errors.delay_days,
            delay_hours: errors.delay_hours,
            delay_minutes: errors.delay_minutes,
            delay_total: errors.delay_total,
        }))

        return !errors.delay_days && !errors.delay_hours && !errors.delay_minutes && !errors.delay_total
    }

    const handleDelayDaysChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const inputValue = e.target.value
        // Allow empty string, otherwise parse as number
        const value = inputValue === "" ? 0 : parseInt(inputValue, 10)
        setDelayDays(isNaN(value) ? 0 : value)
        validateDelayFields(isNaN(value) ? 0 : value, delayHours, delayMinutes)
    }

    const handleDelayHoursChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const inputValue = e.target.value
        // Allow empty string, otherwise parse as number
        const value = inputValue === "" ? 0 : parseInt(inputValue, 10)
        setDelayHours(isNaN(value) ? 0 : value)
        validateDelayFields(delayDays, isNaN(value) ? 0 : value, delayMinutes)
    }

    const handleDelayMinutesChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const inputValue = e.target.value
        // Allow empty string, otherwise parse as number
        const value = inputValue === "" ? 0 : parseInt(inputValue, 10)
        setDelayMinutes(isNaN(value) ? 0 : value)
        validateDelayFields(delayDays, delayHours, isNaN(value) ? 0 : value)
    }

    const handleMaxFollowUpsChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const inputValue = e.target.value
        // Allow empty string, otherwise parse as number
        const value = inputValue === "" ? 0 : parseInt(inputValue, 10)
        setForm({ ...form, max_follow_ups: isNaN(value) ? 0 : value })
        validateMaxFollowUps(isNaN(value) ? 0 : value)
    }

    const validateField = (name: string, value: string) => {
        let error: string | undefined

        switch (name) {
            case "name":
                if (!value.trim()) error = "Campaign name is required"
                break
            case "sender_name":
                if (!value.trim()) error = "Sender name is required"
                break
            case "goal":
                if (!value.trim()) error = "Campaign goal is required"
                break
        }

        setFieldErrors(prev => ({ ...prev, [name]: error }))
        return !error
    }

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
        const { id, value } = e.target
        setForm(prev => ({ ...prev, [id]: value }))
        validateField(id, value)
    }

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()

        const isNameValid = validateField("name", form.name)
        const isSenderNameValid = validateField("sender_name", form.sender_name)
        const isGoalValid = validateField("goal", form.goal)
        const isMaxFollowUpsValid = validateMaxFollowUps(form.max_follow_ups)
        const isDelayValid = validateDelayFields(delayDays, delayHours, delayMinutes)

        if (!isNameValid || !isSenderNameValid || !isGoalValid || !isMaxFollowUpsValid || !isDelayValid) {
            return
        }

        setLoading(true)

        try {
            await post("/campaigns", {
                ...form,
                follow_up_delay_minutes: followUpDelayMinutes
            })
            setForm({ name: "", sender_name: "", goal: "", max_follow_ups: 3 })
            setDelayDays(2)
            setDelayHours(0)
            setDelayMinutes(0)
            setFieldErrors({})
            onSuccess()
        } catch (err) {
            const message = err instanceof Error ? err.message : "Failed to create campaign"
            toast.error(message)
        } finally {
            setLoading(false)
        }
    }

    const hasFieldErrors = Object.values(fieldErrors).some(Boolean)
    const hasEmptyFields = !form.name.trim() || !form.sender_name.trim() || !form.goal.trim()

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
                            value={form.name}
                            onChange={handleInputChange}
                            placeholder="Q1 Outreach"
                            className={fieldErrors.name ? "border-destructive" : ""}
                        />
                        {fieldErrors.name && (
                            <p className="text-xs text-destructive">{fieldErrors.name}</p>
                        )}
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="sender_name">Sender Name</Label>
                        <Input
                            id="sender_name"
                            value={form.sender_name}
                            onChange={handleInputChange}
                            placeholder="John Doe"
                            className={fieldErrors.sender_name ? "border-destructive" : ""}
                        />
                        {fieldErrors.sender_name && (
                            <p className="text-xs text-destructive">{fieldErrors.sender_name}</p>
                        )}
                        <p className="text-xs text-muted-foreground">
                            Emails will be sent from your Google account.
                        </p>
                    </div>

                    <div className="space-y-2">
                        <Label>Follow-up Delay</Label>
                        <div className="grid grid-cols-3 gap-2">
                            <div className="space-y-1">
                                <div className="relative">
                                    <Input
                                        type="number"
                                        min={0}
                                        max={30}
                                        placeholder="0"
                                        value={delayDays || ""}
                                        onChange={handleDelayDaysChange}
                                        className={`pr-12 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none ${fieldErrors.delay_days ? "border-destructive" : ""}`}
                                    />
                                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">Day</span>
                                </div>
                                {fieldErrors.delay_days && (
                                    <p className="text-xs text-destructive">{fieldErrors.delay_days}</p>
                                )}
                            </div>
                            <div className="space-y-1">
                                <div className="relative">
                                    <Input
                                        type="number"
                                        min={0}
                                        max={23}
                                        placeholder="0"
                                        value={delayHours || ""}
                                        onChange={handleDelayHoursChange}
                                        className={`pr-12 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none ${fieldErrors.delay_hours ? "border-destructive" : ""}`}
                                    />
                                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">Hour</span>
                                </div>
                                {fieldErrors.delay_hours && (
                                    <p className="text-xs text-destructive">{fieldErrors.delay_hours}</p>
                                )}
                            </div>
                            <div className="space-y-1">
                                <div className="relative">
                                    <Input
                                        type="number"
                                        min={0}
                                        max={59}
                                        placeholder="0"
                                        value={delayMinutes || ""}
                                        onChange={handleDelayMinutesChange}
                                        className={`pr-12 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none ${fieldErrors.delay_minutes ? "border-destructive" : ""}`}
                                    />
                                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">Min</span>
                                </div>
                                {fieldErrors.delay_minutes && (
                                    <p className="text-xs text-destructive">{fieldErrors.delay_minutes}</p>
                                )}
                            </div>
                        </div>
                        {fieldErrors.delay_total ? (
                            <p className="text-xs text-destructive">{fieldErrors.delay_total}</p>
                        ) : (
                            <p className="text-xs text-muted-foreground">
                                Wait time between follow-up emails (Day: 0-30, Hour: 0-23, Min: 0-59)
                            </p>
                        )}
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="max_follow_ups">Max Follow-ups</Label>
                        <Input
                            id="max_follow_ups"
                            type="number"
                            min={0}
                            placeholder="0"
                            value={form.max_follow_ups || ""}
                            onChange={handleMaxFollowUpsChange}
                            className={`[appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none ${fieldErrors.max_follow_ups ? "border-destructive" : ""}`}
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
                        <Label htmlFor="goal">Campaign Goal</Label>
                        <textarea
                            id="goal"
                            value={form.goal}
                            onChange={handleInputChange}
                            className={`flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 ${fieldErrors.goal ? "border-destructive" : ""}`}
                            placeholder="Example: We help [Marketing Agencies] solve [Lead Quality Issues] by providing [AI Scraping]. The goal is to get them to [Book a 15 min call]."
                        />
                        {fieldErrors.goal && (
                            <p className="text-xs text-destructive">{fieldErrors.goal}</p>
                        )}
                    </div>

                    <DialogFooter>
                        <Button type="button" variant="outline" onClick={onClose}>
                            Cancel
                        </Button>
                        <Button type="submit" disabled={loading || hasFieldErrors || hasEmptyFields}>
                            {loading ? "Creating..." : "Create Campaign"}
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    )
}