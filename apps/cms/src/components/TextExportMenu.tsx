import { useState } from "react";
import type { EpisodeData } from "../api";
import { serializeEpisodeTextToMarkdown, serializeEpisodeTextToTsv } from "../lib/text-export";

type TextExportMenuProps = {
    seriesId: string | undefined;
    seriesTitle?: string;
    episode: EpisodeData | null;
    dirty?: boolean;
};

function timestampForFilename(date = new Date()) {
    const pad = (value: number) => String(value).padStart(2, "0");
    return [
        date.getFullYear(),
        pad(date.getMonth() + 1),
        pad(date.getDate()),
        "-",
        pad(date.getHours()),
        pad(date.getMinutes()),
    ].join("");
}

function makeExportFilename(episodeId: string, ext: "md" | "tsv", dirty: boolean) {
    return `${episodeId}_text-export${dirty ? "_unsaved" : ""}_${timestampForFilename()}.${ext}`;
}

function downloadTextFile(filename: string, body: string, type: string) {
    const blob = new Blob([body], { type });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = filename;
    document.body.append(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);
}

export function TextExportMenu({ seriesId, seriesTitle, episode, dirty = false }: TextExportMenuProps) {
    const [open, setOpen] = useState(false);
    const disabled = !seriesId || !episode;

    const exportMarkdown = () => {
        if (!seriesId || !episode) return;
        downloadTextFile(
            makeExportFilename(episode.id, "md", dirty),
            serializeEpisodeTextToMarkdown({ seriesId, seriesTitle, episode }),
            "text/markdown;charset=utf-8",
        );
        setOpen(false);
    };

    const exportTsv = () => {
        if (!seriesId || !episode) return;
        downloadTextFile(
            makeExportFilename(episode.id, "tsv", dirty),
            serializeEpisodeTextToTsv({ seriesId, seriesTitle, episode }),
            "text/tab-separated-values;charset=utf-8",
        );
        setOpen(false);
    };

    return (
        <div className="text-export-menu">
            <button
                type="button"
                className="btn btn-outline"
                disabled={disabled}
                onClick={() => setOpen((current) => !current)}
            >
                Text export
            </button>
            {open && !disabled && (
                <div className="text-export-popover">
                    {dirty && <p className="text-export-warning">未保存の編集内容を含めて書き出します。</p>}
                    <button type="button" onClick={exportMarkdown}>Markdownを書き出す</button>
                    <button type="button" onClick={exportTsv}>TSVを書き出す</button>
                </div>
            )}
        </div>
    );
}
