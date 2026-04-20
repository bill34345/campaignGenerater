import path from "node:path";
import "@testing-library/jest-dom/vitest";

const testDatabasePath = path.resolve(process.cwd(), "prisma", "dev.db");
process.env.DATABASE_URL = `file:${testDatabasePath.replace(/\\/g, "/")}`;
