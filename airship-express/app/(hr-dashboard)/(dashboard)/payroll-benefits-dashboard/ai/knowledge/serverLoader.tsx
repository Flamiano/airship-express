import "server-only";
import fs from "fs";
import path from "path";

const KNOWLEDGE_DIR = path.join(
    process.cwd(),
    "app",
    "(hr-dashboard)",
    "(dashboard)",
    "payroll-benefits-dashboard",
    "ai",
    "knowledge",
    "static"
);

export function loadKnowledgeServer(key: string): string {
    if (!/^[a-z0-9-]+$/i.test(key)) {
        throw new Error("Invalid knowledge key");
    }

    const filePath = path.join(KNOWLEDGE_DIR, `${key}.md`);

    try {
        return fs.readFileSync(filePath, "utf-8");
    } catch {
        return "";
    }
}