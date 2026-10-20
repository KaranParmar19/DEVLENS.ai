import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Normalizes any user-entered GitHub repository string into a canonical
 * https://github.com/owner/repo URL.
 *
 * Handles:
 * - "owner/repo" -> "https://github.com/owner/repo"
 * - "github.com/owner/repo" -> "https://github.com/owner/repo"
 * - "https://github.com/owner/repo" -> "https://github.com/owner/repo"
 * - "https://github.com/owner/repo/" -> "https://github.com/owner/repo"
 * - "https://github.com/owner/repo.git" -> "https://github.com/owner/repo"
 * - "git@github.com:owner/repo.git" -> "https://github.com/owner/repo"
 * - Accidental nesting: "github.com/github.com/owner/repo" -> "https://github.com/owner/repo"
 */
export function normalizeRepoUrl(input?: string | null): string {
  if (!input) return "";
  let val = input.trim();
  if (!val) return "";

  // Strip enclosing quotes
  val = val.replace(/^["']|["']$/g, "").trim();

  // Handle SSH format
  if (val.startsWith("git@github.com:")) {
    val = "https://github.com/" + val.slice("git@github.com:".length);
  }

  // Strip trailing slashes
  val = val.replace(/\/+$/, "");

  // Strip .git at the end
  if (val.endsWith(".git")) {
    val = val.slice(0, -4);
  }

  // Remove duplicate nested github.com prefixes if pasted into prefixed input
  val = val.replace(
    /^(?:https?:\/\/)?(?:www\.)?github\.com\/(?:https?:\/\/)?(?:www\.)?github\.com\//i,
    "https://github.com/"
  );

  // If starts with http:// or https://
  if (/^https?:\/\//i.test(val)) {
    return val;
  }

  // If starts with github.com/ or www.github.com/
  if (/^(?:www\.)?github\.com\//i.test(val)) {
    return `https://${val.replace(/^www\./i, "")}`;
  }

  // Otherwise assume it's owner/repo
  return `https://github.com/${val}`;
}
