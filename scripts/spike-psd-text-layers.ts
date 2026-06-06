import { parsePsdTextLayerDrafts } from "../packages/ingestion/dist/index.js";

const sourceFile = process.argv[2];

if (!sourceFile) {
    console.error("Usage: node --experimental-strip-types scripts/spike-psd-text-layers.ts <file.psd|file.psb>");
    process.exit(1);
}

const result = await parsePsdTextLayerDrafts({ sourceFile });
console.log(JSON.stringify(result, null, 2));
