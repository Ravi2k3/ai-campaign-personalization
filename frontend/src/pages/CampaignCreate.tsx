import { useState, useMemo } from "react"
import { useNavigate } from "react-router-dom"
import { post } from "@/lib/api"
import { parseApiError } from "@/lib/errors"
import { useBreadcrumbs } from "@/contexts/BreadcrumbContext"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Card, CardContent, CardFooter } from "@/components/ui/card"
import { ArrowLeft } from "lucide-react"

type Campaign = {
    id: string
    name: string
}

type FieldErrors = {
    name?: string
    sender_name?: string
    goal?: string
    max_follow_ups?: string
    delay_days?: string
    delay_hours?: string
    delay_minutes?: string
    delay_total?: string
}

const EMPTY_FORM = {
    name: "",
    sender_name: "",
    goal: "",
    max_follow_ups: 3,
    scheduled_start_at: "",
}

/**
 * Section wrapper. Gives every form section a consistent header + helper text
 * pattern and predictable vertical rhythm, which is what was missing from the
 * old modal. Children render below the divider line.
 */
function Section({
    title,
    description,
    children,
}: {
    title: string
    description?: string
    children: React.ReactNode
}) {
    return (
        <section className="py-6 border-b last:border-b-0">
            <div className="mb-4">
                <h2 className="text-[13px] font-semibold tracking-tight">{title}</h2>
                {description && (
                    <p className="text-[12px] text-muted-foreground mt-0.5">{description}</p>
                )}
            </div>
            <div className="space-y-4">{children}</div>
        </section>
    )
}

export default function CampaignCreate() {
    const navigate = useNavigate()
    useBreadcrumbs([
        { label: "Campaigns", href: "/" },
        { label: "New Campaign" },
    ])

    const [loading, setLoading] = useState(false)
    const [fieldErrors, setFieldErrors] = useState<FieldErrors>({})
    const [form, setForm] = useState(EMPTY_FORM)

    const [delayDays, setDelayDays] = useState(2)
    const [delayHours, setDelayHours] = useState(0)
    const [delayMinutes, setDelayMinutes] = useState(0)

    const followUpDelayMinutes = useMemo(
        () => delayDays * 24 * 60 + delayHours * 60 + delayMinutes,
        [delayDays, delayHours, delayMinutes],
    )

    // ── Validation ──────────────────────────────────────────────────────

    const validateField = (name: keyof FieldErrors, value: string): boolean => {
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

    const validateMaxFollowUps = (value: number): boolean => {
        const ok = value >= 1 && value <= 10
        setFieldErrors(prev => ({
            ...prev,
            max_follow_ups: ok ? undefined : "Must be between 1 and 10",
        }))
        return ok
    }

    const validateDelay = (days: number, hours: number, minutes: number): boolean => {
        const errors: FieldErrors = {}
        if (days < 0 || days > 30) errors.delay_days = "Days must be between 0 and 30"
        if (hours < 0 || hours > 23) errors.delay_hours = "Hours must be between 0 and 23"
        if (minutes < 0 || minutes > 59) errors.delay_minutes = "Minutes must be between 0 and 59"
        if (days * 24 * 60 + hours * 60 + minutes < 1) {
            errors.delay_total = "Total delay must be at least 1 minute"
        }
        setFieldErrors(prev => ({ ...prev, ...errors, delay_total: errors.delay_total }))
        return !errors.delay_days && !errors.delay_hours && !errors.delay_minutes && !errors.delay_total
    }

    // ── Handlers ────────────────────────────────────────────────────────

    const handleText = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
        const { id, value } = e.target
        setForm(prev => ({ ...prev, [id]: value }))
        validateField(id as keyof FieldErrors, value)
    }

    const handleIntInput = (
        e: React.ChangeEvent<HTMLInputElement>,
        setter: (n: number) => void,
        validate: (n: number) => void,
    ) => {
        const raw = e.target.value
        const parsed = raw === "" ? 0 : parseInt(raw, 10)
        const n = isNaN(parsed) ? 0 : parsed
        setter(n)
        validate(n)
    }

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()

        const checks = [
            validateField("name", form.name),
            validateField("sender_name", form.sender_name),
            validateField("goal", form.goal),
            validateMaxFollowUps(form.max_follow_ups),
            validateDelay(delayDays, delayHours, delayMinutes),
        ]
        if (!checks.every(Boolean)) return

        setLoading(true)
        try {
            const created = await post<Campaign>("/campaigns", {
                ...form,
                follow_up_delay_minutes: followUpDelayMinutes,
            })
            toast.success("Campaign created")
            navigate(`/campaigns/${created.id}`)
        } catch (err) {
            toast.error(parseApiError(err))
        } finally {
            setLoading(false)
        }
    }

    const hasFieldErrors = Object.values(fieldErrors).some(Boolean)
    const hasEmptyFields = !form.name.trim() || !form.sender_name.trim() || !form.goal.trim()

    // ── Render ──────────────────────────────────────────────────────────

    return (
        <div className="p-6">
            <div className="max-w-3xl mx-auto">
                {/* Header */}
                <div className="mb-6 flex items-center gap-3">
                    <Button variant="ghost" size="sm" onClick={() => navigate("/")} className="gap-1.5">
                        <ArrowLeft size={14} />
                        Back
                    </Button>
                </div>
                <div className="mb-6">
                    <h1 className="text-2xl font-semibold tracking-tight">Create Campaign</h1>
                    <p className="text-muted-foreground text-sm mt-1">
                        Configure a new email outreach campaign. You can add leads after creating.
                    </p>
                </div>

                <form onSubmit={handleSubmit}>
                  <Card>
                    <CardContent className="py-0">
                    {/* ── Basics ───────────────────────────────────────── */}
                    <Section
                        title="Basics"
                        description="The campaign name is internal. The sender name appears in the 'From' field of sent emails."
                    >
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div className="space-y-1.5">
                                <Label htmlFor="name" className="text-[12px]">Campaign Name</Label>
                                <Input
                                    id="name"
                                    value={form.name}
                                    onChange={handleText}
                                    placeholder="Q1 Outreach"
                                    aria-invalid={!!fieldErrors.name}
                                    aria-describedby={fieldErrors.name ? "name-error" : undefined}
                                    className={fieldErrors.name ? "border-destructive" : ""}
                                />
                                {fieldErrors.name && (
                                    <p id="name-error" className="text-[11px] text-destructive">{fieldErrors.name}</p>
                                )}
                            </div>
                            <div className="space-y-1.5">
                                <Label htmlFor="sender_name" className="text-[12px]">Sender Name</Label>
                                <Input
                                    id="sender_name"
                                    value={form.sender_name}
                                    onChange={handleText}
                                    placeholder="John Doe"
                                    aria-invalid={!!fieldErrors.sender_name}
                                    aria-describedby={fieldErrors.sender_name ? "sender_name-error" : undefined}
                                    className={fieldErrors.sender_name ? "border-destructive" : ""}
                                />
                                {fieldErrors.sender_name && (
                                    <p id="sender_name-error" className="text-[11px] text-destructive">{fieldErrors.sender_name}</p>
                                )}
                            </div>
                        </div>
                        <p className="text-[11px] text-muted-foreground">
                            Emails send from your connected Google account.
                        </p>
                    </Section>

                    {/* ── Sequence ────────────────────────────────────── */}
                    <Section
                        title="Sequence"
                        description="How often and how many times to follow up before stopping."
                    >
                        <div className="space-y-1.5">
                            <Label className="text-[12px]">Follow-up Delay</Label>
                            <div className="grid grid-cols-3 gap-2">
                                <div className="space-y-1">
                                    <div className="relative">
                                        <Input
                                            type="number"
                                            min={0}
                                            max={30}
                                            placeholder="0"
                                            value={delayDays || ""}
                                            onChange={e => handleIntInput(e, setDelayDays, n => validateDelay(n, delayHours, delayMinutes))}
                                            className={`pr-12 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none ${fieldErrors.delay_days ? "border-destructive" : ""}`}
                                        />
                                        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">Day</span>
                                    </div>
                                    {fieldErrors.delay_days && <p className="text-[11px] text-destructive">{fieldErrors.delay_days}</p>}
                                </div>
                                <div className="space-y-1">
                                    <div className="relative">
                                        <Input
                                            type="number"
                                            min={0}
                                            max={23}
                                            placeholder="0"
                                            value={delayHours || ""}
                                            onChange={e => handleIntInput(e, setDelayHours, n => validateDelay(delayDays, n, delayMinutes))}
                                            className={`pr-12 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none ${fieldErrors.delay_hours ? "border-destructive" : ""}`}
                                        />
                                        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">Hour</span>
                                    </div>
                                    {fieldErrors.delay_hours && <p className="text-[11px] text-destructive">{fieldErrors.delay_hours}</p>}
                                </div>
                                <div className="space-y-1">
                                    <div className="relative">
                                        <Input
                                            type="number"
                                            min={0}
                                            max={59}
                                            placeholder="0"
                                            value={delayMinutes || ""}
                                            onChange={e => handleIntInput(e, setDelayMinutes, n => validateDelay(delayDays, delayHours, n))}
                                            className={`pr-12 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none ${fieldErrors.delay_minutes ? "border-destructive" : ""}`}
                                        />
                                        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">Min</span>
                                    </div>
                                    {fieldErrors.delay_minutes && <p className="text-[11px] text-destructive">{fieldErrors.delay_minutes}</p>}
                                </div>
                            </div>
                            {fieldErrors.delay_total ? (
                                <p className="text-[11px] text-destructive">{fieldErrors.delay_total}</p>
                            ) : (
                                <p className="text-[11px] text-muted-foreground">
                                    Wait time between follow-up emails.
                                </p>
                            )}
                        </div>

                        <div className="space-y-1.5">
                            <Label htmlFor="max_follow_ups" className="text-[12px]">Max Follow-ups</Label>
                            <Input
                                id="max_follow_ups"
                                type="number"
                                min={1}
                                max={10}
                                value={form.max_follow_ups || ""}
                                onChange={e => {
                                    const raw = e.target.value
                                    const parsed = raw === "" ? 0 : parseInt(raw, 10)
                                    const n = isNaN(parsed) ? 0 : parsed
                                    setForm(prev => ({ ...prev, max_follow_ups: n }))
                                    validateMaxFollowUps(n)
                                }}
                                aria-invalid={!!fieldErrors.max_follow_ups}
                                aria-describedby={fieldErrors.max_follow_ups ? "max_follow_ups-error" : undefined}
                                className={`[appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none ${fieldErrors.max_follow_ups ? "border-destructive" : ""}`}
                            />
                            {fieldErrors.max_follow_ups ? (
                                <p id="max_follow_ups-error" className="text-[11px] text-destructive">{fieldErrors.max_follow_ups}</p>
                            ) : (
                                <p className="text-[11px] text-muted-foreground">1–10 follow-up emails before stopping.</p>
                            )}
                        </div>
                    </Section>

                    {/* ── Goal ─────────────────────────────────────────── */}
                    <Section
                        title="Campaign Goal"
                        description="What the LLM uses to personalise every email. Be specific: what you sell, who it's for, what action you want."
                    >
                        <div className="space-y-1.5">
                            <Textarea
                                id="goal"
                                value={form.goal}
                                onChange={handleText}
                                rows={10}
                                aria-invalid={!!fieldErrors.goal}
                                aria-describedby={fieldErrors.goal ? "goal-error" : undefined}
                                placeholder={`We help [who] solve [their problem] by [your solution].\n\nProof points:\n- ...\n\nGoal: get them to [specific action, e.g. book a 20-min call].`}
                                className="min-h-[180px]"
                            />
                            {fieldErrors.goal && <p id="goal-error" className="text-[11px] text-destructive">{fieldErrors.goal}</p>}
                        </div>
                    </Section>

                    {/* ── Scheduling ───────────────────────────────────── */}
                    <Section
                        title="Scheduling"
                        description="Optional. Leave empty to start manually after adding leads."
                    >
                        <div className="space-y-1.5">
                            <Label htmlFor="scheduled_start_at" className="text-[12px]">Start at</Label>
                            <Input
                                id="scheduled_start_at"
                                type="datetime-local"
                                value={form.scheduled_start_at}
                                onChange={e => setForm(prev => ({ ...prev, scheduled_start_at: e.target.value }))}
                                className="max-w-xs"
                            />
                            <p className="text-[11px] text-muted-foreground">
                                The campaign will auto-activate at this time, provided it has leads.
                            </p>
                        </div>
                    </Section>

                    </CardContent>
                    <CardFooter className="justify-end gap-2 border-t">
                        <Button type="button" variant="outline" onClick={() => navigate("/")}>
                            Cancel
                        </Button>
                        <Button type="submit" disabled={loading || hasFieldErrors || hasEmptyFields}>
                            {loading ? "Creating..." : "Create Campaign"}
                        </Button>
                    </CardFooter>
                  </Card>
                </form>
            </div>
        </div>
    )
}
