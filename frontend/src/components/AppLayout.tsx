import { Link } from "react-router-dom"
import { useBreadcrumbItems } from "@/contexts/BreadcrumbContext"
import { Separator } from "@/components/ui/separator"
import {
    Breadcrumb,
    BreadcrumbItem,
    BreadcrumbLink,
    BreadcrumbList,
    BreadcrumbPage,
    BreadcrumbSeparator,
} from "@/components/ui/breadcrumb"
import { Mail } from "lucide-react"
import UserMenu from "@/components/UserMenu"
import DarkModeToggle from "@/components/DarkModeToggle"

export default function AppLayout({ children }: { children: React.ReactNode }) {
    const breadcrumbItems = useBreadcrumbItems()

    return (
        <div className="h-screen bg-background flex flex-col">
            {/* Header */}
            <header className="sticky top-0 z-20 bg-background border-b">
                <div className="max-w-6xl mx-auto px-8 h-14 flex items-center justify-between">
                    <Link to="/" className="flex items-center gap-2 hover:opacity-80 transition-opacity">
                        <div className="rounded-md bg-primary/10 p-1.5">
                            <Mail className="h-4 w-4 text-primary" />
                        </div>
                        <span className="font-semibold text-sm hidden sm:inline">AI Mail</span>
                    </Link>

                    <div className="flex items-center gap-1">
                        <DarkModeToggle />
                        <UserMenu />
                    </div>
                </div>

                {/* Breadcrumbs */}
                {breadcrumbItems.length > 0 && (
                    <>
                        <Separator />
                        <div className="max-w-6xl mx-auto px-8 py-2">
                            <Breadcrumb>
                                <BreadcrumbList>
                                    {breadcrumbItems.map((item, index) => {
                                        const isLast = index === breadcrumbItems.length - 1
                                        return (
                                            <span key={item.label} className="flex items-center gap-1.5">
                                                {index > 0 && <BreadcrumbSeparator />}
                                                <BreadcrumbItem>
                                                    {isLast || !item.href ? (
                                                        <BreadcrumbPage>{item.label}</BreadcrumbPage>
                                                    ) : (
                                                        <BreadcrumbLink asChild>
                                                            <Link to={item.href}>{item.label}</Link>
                                                        </BreadcrumbLink>
                                                    )}
                                                </BreadcrumbItem>
                                            </span>
                                        )
                                    })}
                                </BreadcrumbList>
                            </Breadcrumb>
                        </div>
                    </>
                )}
            </header>

            {/* Content */}
            <main className="flex-1 overflow-y-auto">
                {children}
            </main>
        </div>
    )
}
