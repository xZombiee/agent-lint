import { access } from "node:fs/promises";
export async function pathExists(targetPath) {
    try {
        await access(targetPath);
        return true;
    }
    catch {
        return false;
    }
}
//# sourceMappingURL=pathExists.js.map