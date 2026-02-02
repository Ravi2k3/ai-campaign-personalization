import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Get timezone abbreviation (IST, EST, PST, etc.)
 */
export function getTimezoneAbbr(): string {
  const date = new Date()
  const parts = new Intl.DateTimeFormat(undefined, { timeZoneName: "short" }).formatToParts(date)
  const tzPart = parts.find(p => p.type === "timeZoneName")?.value || ""
  
  // If already an abbreviation, use it
  if (/^[A-Z]{2,5}$/.test(tzPart)) {
    return tzPart
  }
  
  // Try to get abbreviation from long name
  const longParts = new Intl.DateTimeFormat("en-US", { timeZoneName: "long" }).formatToParts(date)
  const longTz = longParts.find(p => p.type === "timeZoneName")?.value || ""
  
  const tzMappings: Record<string, string> = {
    // Americas
    "Pacific Standard Time": "PST",
    "Pacific Daylight Time": "PDT",
    "Mountain Standard Time": "MST",
    "Mountain Daylight Time": "MDT",
    "Central Standard Time": "CST",
    "Central Daylight Time": "CDT",
    "Eastern Standard Time": "EST",
    "Eastern Daylight Time": "EDT",
    "Alaska Standard Time": "AKST",
    "Alaska Daylight Time": "AKDT",
    "Hawaii-Aleutian Standard Time": "HST",
    "Atlantic Standard Time": "AST",
    "Atlantic Daylight Time": "ADT",
    "Newfoundland Standard Time": "NST",
    "Newfoundland Daylight Time": "NDT",
    "Argentina Standard Time": "ART",
    "Brasilia Standard Time": "BRT",
    "Chile Standard Time": "CLT",
    "Colombia Standard Time": "COT",
    "Peru Standard Time": "PET",
    "Venezuela Time": "VET",
    
    // Europe
    "Greenwich Mean Time": "GMT",
    "Coordinated Universal Time": "UTC",
    "British Summer Time": "BST",
    "Western European Time": "WET",
    "Western European Summer Time": "WEST",
    "Central European Time": "CET",
    "Central European Summer Time": "CEST",
    "Eastern European Time": "EET",
    "Eastern European Summer Time": "EEST",
    "Moscow Standard Time": "MSK",
    "Turkey Time": "TRT",
    
    // Asia
    "India Standard Time": "IST",
    "Indian Standard Time": "IST",
    "Pakistan Standard Time": "PKT",
    "Bangladesh Standard Time": "BST",
    "Nepal Time": "NPT",
    "Sri Lanka Standard Time": "SLST",
    "Myanmar Time": "MMT",
    "Indochina Time": "ICT",
    "Western Indonesia Time": "WIB",
    "Central Indonesia Time": "WITA",
    "Eastern Indonesia Time": "WIT",
    "China Standard Time": "CST",
    "Hong Kong Time": "HKT",
    "Singapore Standard Time": "SGT",
    "Singapore Time": "SGT",
    "Malaysia Time": "MYT",
    "Philippine Standard Time": "PHT",
    "Korea Standard Time": "KST",
    "Japan Standard Time": "JST",
    "Taiwan Standard Time": "TST",
    "Gulf Standard Time": "GST",
    "Arabian Standard Time": "AST",
    "Israel Standard Time": "IST",
    "Israel Daylight Time": "IDT",
    
    // Australia & Pacific
    "Australian Western Standard Time": "AWST",
    "Australian Central Standard Time": "ACST",
    "Australian Central Daylight Time": "ACDT",
    "Australian Eastern Standard Time": "AEST",
    "Australian Eastern Daylight Time": "AEDT",
    "New Zealand Standard Time": "NZST",
    "New Zealand Daylight Time": "NZDT",
    "Fiji Standard Time": "FJT",
    "Papua New Guinea Time": "PGT",
    
    // Africa
    "West Africa Time": "WAT",
    "Central Africa Time": "CAT",
    "East Africa Time": "EAT",
    "South Africa Standard Time": "SAST",
  }
  
  return tzMappings[longTz] || tzPart
}

/**
 * Format time with separate timezone for styling
 */
export function formatTime(dateString: string | null): { time: string; timezone: string } | null {
  if (!dateString) return null
  const date = new Date(dateString)
  const time = date.toLocaleString(undefined, { hour: "numeric", minute: "2-digit" })
  return { time, timezone: getTimezoneAbbr() }
}