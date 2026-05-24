import type { PageArtifactBundle } from "../types/index.js";

export interface ArtifactStore {
    put(bundle: PageArtifactBundle): Promise<void>;
    get(pageId: string): Promise<PageArtifactBundle | undefined>;
    list(): Promise<PageArtifactBundle[]>;
}

export class InMemoryArtifactStore implements ArtifactStore {
    private readonly bundles = new Map<string, PageArtifactBundle>();

    async put(bundle: PageArtifactBundle): Promise<void> {
        this.bundles.set(bundle.pageId, bundle);
    }

    async get(pageId: string): Promise<PageArtifactBundle | undefined> {
        return this.bundles.get(pageId);
    }

    async list(): Promise<PageArtifactBundle[]> {
        return Array.from(this.bundles.values());
    }
}
