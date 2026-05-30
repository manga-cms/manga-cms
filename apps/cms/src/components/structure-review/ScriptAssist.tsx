type ScriptAssistProps = {
    value: string;
    disabled: boolean;
    onChange: (value: string) => void;
    onApply: () => void;
};

export function ScriptAssist({ value, disabled, onChange, onApply }: ScriptAssistProps) {
    return (
        <>
            <h2>Script Assist</h2>
            <div className="script-assist">
                <textarea
                    value={value}
                    onChange={(e) => onChange(e.target.value)}
                    placeholder={"うた「……」\nコンコン「今読んでるビューアーのこと、知りたい？」\n《ピカッ》"}
                    rows={6}
                />
                <button type="button" className="btn btn-outline" onClick={onApply} disabled={disabled}>
                    Add as bubbles
                </button>
                <p className="card-meta">選択中 Panel に Bubble 候補を追加します。位置は仮置きなので、右側のInspectorかドラッグで調整してください。</p>
            </div>
        </>
    );
}
