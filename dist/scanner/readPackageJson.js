import path from "node:path";
import { readFile } from "node:fs/promises";
import { pathExists } from "../utils/pathExists.js";
export async function readPackageJson(projectRoot) {
    const packageJsonPath = path.join(projectRoot, "package.json");
    if (!(await pathExists(packageJsonPath))) {
        return null;
    }
    const rawPackageJson = await readFile(packageJsonPath, "utf8");
    const parsedPackageJson = JSON.parse(rawPackageJson);
    if (typeof parsedPackageJson !== "object" || parsedPackageJson === null) {
        throw new Error("package.json must contain a JSON object.");
    }
    const packageJson = parsedPackageJson;
    const result = {};
    if (isRecordOfStrings(packageJson.scripts)) {
        result.scripts = packageJson.scripts;
    }
    if (isRecordOfStrings(packageJson.dependencies)) {
        result.dependencies = packageJson.dependencies;
    }
    if (isRecordOfStrings(packageJson.devDependencies)) {
        result.devDependencies = packageJson.devDependencies;
    }
    if (isRecordOfStrings(packageJson.engines)) {
        result.engines = packageJson.engines;
    }
    if (typeof packageJson.packageManager === "string") {
        result.packageManager = packageJson.packageManager;
    }
    return result;
}
function isRecordOfStrings(value) {
    if (typeof value !== "object" || value === null || Array.isArray(value)) {
        return false;
    }
    return Object.values(value).every((item) => typeof item === "string");
}
//# sourceMappingURL=readPackageJson.js.map