import type { BubbleData } from "../../api";

export function parseScriptAssistLines(text: string): { speaker?: string; textOriginal: string; bubbleType: BubbleData["bubbleType"] }[] {
    return text
        .split(/\r?\n/)
        .map((line) => line.trim())
        .filter(Boolean)
        .map((line) => {
            const sfx = line.match(/^《(.+)》$/);
            if (sfx) {
                return { textOriginal: sfx[1], bubbleType: "sfx" as const };
            }

            const dialogue = line.match(/^(.+?)\s*[「“](.+)[」”]$/);
            if (dialogue) {
                return {
                    speaker: dialogue[1].trim(),
                    textOriginal: dialogue[2].trim(),
                    bubbleType: "speech" as const,
                };
            }

            return { textOriginal: line, bubbleType: "narration" as const };
        });
}
