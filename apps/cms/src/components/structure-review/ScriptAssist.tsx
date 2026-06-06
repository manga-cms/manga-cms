import { useTranslation } from "../../i18n/I18nProvider";

type ScriptAssistProps = {
    value: string;
    disabled: boolean;
    onChange: (value: string) => void;
    onApply: () => void;
};

export function ScriptAssist({ value, disabled, onChange, onApply }: ScriptAssistProps) {
    const { t } = useTranslation();

    return (
        <>
            <h2>{t("structure.sidebar.scriptAssist")}</h2>
            <div className="script-assist">
                <textarea
                    value={value}
                    onChange={(e) => onChange(e.target.value)}
                    placeholder={"うた「……」\nコンコン「今読んでるビューアーのこと、知りたい？」\n《ピカッ》"}
                    rows={6}
                />
                <button type="button" className="btn btn-outline" onClick={onApply} disabled={disabled}>
                    {t("structure.sidebar.addAsBubbles")}
                </button>
                <p className="card-meta">{t("structure.sidebar.scriptHelp")}</p>
            </div>
        </>
    );
}
