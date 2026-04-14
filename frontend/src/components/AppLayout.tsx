import { Link } from "react-router-dom"
import { useBreadcrumbItems } from "@/contexts/BreadcrumbContext"
import {
    Breadcrumb,
    BreadcrumbItem,
    BreadcrumbLink,
    BreadcrumbList,
    BreadcrumbPage,
    BreadcrumbSeparator,
} from "@/components/ui/breadcrumb"
import { Send } from "lucide-react"
import UserMenu from "@/components/UserMenu"
import DarkModeToggle from "@/components/DarkModeToggle"

export default function AppLayout({ children }: { children: React.ReactNode }) {
    const breadcrumbItems = useBreadcrumbItems()

    return (
        <div className="h-screen bg-background flex flex-col">
            {/* Header */}
            <header className="sticky top-0 z-20 bg-background/80 backdrop-blur-xl border-b">
                <div className="max-w-6xl mx-auto px-6 sm:px-8">
                    <div className="h-14 flex items-center justify-between">
                        <div className="flex items-center gap-6">
                            <Link to="/" className="flex items-center gap-2.5 group">
                                <div className="rounded-lg bg-primary p-1.5 shadow-sm group-hover:shadow-md transition-shadow">
                                    <Send className="h-3.5 w-3.5 text-primary-foreground" />
                                </div>
                                <span className="font-semibold text-[15px] tracking-tight hidden sm:inline">
                                    Outreach
                                </span>
                            </Link>

                            {/* Breadcrumbs inline with logo */}
                            {breadcrumbItems.length > 0 && (
                                <div className="hidden sm:block">
                                    <Breadcrumb>
                                        <BreadcrumbList>
                                            {breadcrumbItems.map((item, index) => {
                                                const isLast = index === breadcrumbItems.length - 1
                                                return (
                                                    <span key={item.label} className="flex items-center gap-1.5">
                                                        {index > 0 && <BreadcrumbSeparator />}
                                                        <BreadcrumbItem>
                                                            {isLast || !item.href ? (
                                                                <BreadcrumbPage className="text-[13px]">
                                                                    {item.label}
                                                                </BreadcrumbPage>
                                                            ) : (
                                                                <BreadcrumbLink asChild>
                                                                    <Link to={item.href} className="text-[13px]">
                                                                        {item.label}
                                                                    </Link>
                                                                </BreadcrumbLink>
                                                            )}
                                                        </BreadcrumbItem>
                                                    </span>
                                                )
                                            })}
                                        </BreadcrumbList>
                                    </Breadcrumb>
                                </div>
                            )}
                        </div>

                        <div className="flex items-center gap-0.5">
                            <DarkModeToggle />
                            <UserMenu />
                        </div>
                    </div>
                </div>
            </header>

            {/* Content */}
            <main className="flex-1 overflow-y-auto">
                {children}
            </main>
        </div>
    )
}
