import { useRef, useState, type DragEvent, type ChangeEvent } from "react";
import { Upload, FileText, X, CheckCircle2, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";

type Props = {
  onFileLoaded: (csvText: string, filename: string) => void;
  onClear?: () => void;
  /** Maximum file size in MB (default 10). */
  maxMb?: number;
  disabled?: boolean;
};

type DetectedFormat =
  | "meta"
  | "google"
  | "unknown"
  | null;

/**
 * Drag-drop CSV upload box for the Performance tab.
 *
 * Reads the file into memory (FileReader as text), shows a 5-row preview,
 * does a quick header sniff to tell the user whether we think it's Meta vs
 * Google. Real validation happens server-side; this is just a hint so the
 * user knows to fix obvious mistakes before clicking Submit.
 */
export function CSVDropzone({
  onFileLoaded,
  onClear,
  maxMb = 10,
  disabled = false,
}: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [isDragOver, setIsDragOver] = useState(false);
  const [filename, setFilename] = useState<string | null>(null);
  const [previewLines, setPreviewLines] = useState<string[]>([]);
  const [detectedFormat, setDetectedFormat] = useState<DetectedFormat>(null);
  const [error, setError] = useState<string | null>(null);

  const handleFile = (file: File) => {
    setError(null);
    if (!file) return;
    if (!/\.csv$|\.tsv$/i.test(file.name)) {
      setError("Vui lòng chọn file .csv hoặc .tsv");
      return;
    }
    const sizeMb = file.size / 1024 / 1024;
    if (sizeMb > maxMb) {
      setError(`File quá lớn (${sizeMb.toFixed(1)}MB). Tối đa ${maxMb}MB.`);
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      const text = String(e.target?.result ?? "");
      const lines = text.split(/\r?\n/).filter((l) => l.trim().length > 0);
      setFilename(file.name);
      setPreviewLines(lines.slice(0, 6)); // header + 5 data rows

      // Quick header sniff
      const header = lines[0]?.toLowerCase() ?? "";
      const metaSignals = [
        "amount spent",
        "campaign name",
        "ad set name",
        "frequency",
        "reach",
      ].filter((t) => header.includes(t)).length;
      const googleSignals = [
        "ad group",
        "avg. cpc",
        "cost / conv",
        "conv. value",
      ].filter((t) => header.includes(t)).length;
      if (metaSignals === 0 && googleSignals === 0) {
        setDetectedFormat("unknown");
      } else if (metaSignals >= googleSignals) {
        setDetectedFormat("meta");
      } else {
        setDetectedFormat("google");
      }

      onFileLoaded(text, file.name);
    };
    reader.onerror = () => setError("Không đọc được file");
    reader.readAsText(file, "utf-8");
  };

  const handleDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  };

  const handleInputChange = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
  };

  const clear = () => {
    setFilename(null);
    setPreviewLines([]);
    setDetectedFormat(null);
    setError(null);
    if (inputRef.current) inputRef.current.value = "";
    onClear?.();
  };

  return (
    <div className="space-y-3">
      <div
        onDragOver={(e) => {
          e.preventDefault();
          if (!disabled) setIsDragOver(true);
        }}
        onDragLeave={() => setIsDragOver(false)}
        onDrop={handleDrop}
        onClick={() => !disabled && inputRef.current?.click()}
        className={`border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition-all ${
          disabled
            ? "opacity-50 cursor-not-allowed border-border/30"
            : isDragOver
              ? "border-amber-500/60 bg-amber-500/10"
              : "border-border/50 hover:border-amber-500/40 hover:bg-amber-500/5"
        }`}
        data-testid="csv-dropzone"
      >
        <input
          ref={inputRef}
          type="file"
          accept=".csv,.tsv,text/csv"
          onChange={handleInputChange}
          disabled={disabled}
          className="hidden"
        />
        {!filename ? (
          <>
            <Upload className="w-8 h-8 mx-auto mb-2 text-amber-400/70" />
            <p className="text-sm font-medium">
              Kéo-thả CSV ads vào đây hoặc click chọn
            </p>
            <p className="text-xs text-muted-foreground mt-1.5">
              Meta Ads Manager Export hoặc Google Ads Editor • Tối đa {maxMb}MB
            </p>
          </>
        ) : (
          <div className="flex items-center justify-between gap-3">
            <FileText className="w-8 h-8 text-amber-400 shrink-0" />
            <div className="flex-1 text-left min-w-0">
              <p className="text-sm font-medium truncate">{filename}</p>
              <p className="text-xs text-muted-foreground">
                {previewLines.length > 0 &&
                  `${previewLines.length - 1} dòng đầu trong file`}
              </p>
            </div>
            <Button
              size="sm"
              variant="ghost"
              onClick={(e) => {
                e.stopPropagation();
                clear();
              }}
            >
              <X className="w-3.5 h-3.5" />
            </Button>
          </div>
        )}
      </div>

      {error && (
        <div className="border border-rose-500/30 bg-rose-500/5 rounded-lg p-3 text-xs flex items-start gap-2">
          <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}

      {detectedFormat && (
        <div
          className={`text-xs px-3 py-2 rounded-lg flex items-center gap-2 ${
            detectedFormat === "unknown"
              ? "border border-amber-500/30 bg-amber-500/5 text-amber-400"
              : "border border-emerald-500/30 bg-emerald-500/5 text-emerald-400"
          }`}
        >
          {detectedFormat === "unknown" ? (
            <>
              <AlertTriangle className="w-3.5 h-3.5" />
              <span>
                Không nhận dạng được format. Server sẽ thử parse nhưng có thể
                fail. Hãy export đúng từ Meta Ads Manager hoặc Google Ads Editor.
              </span>
            </>
          ) : (
            <>
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>
                Đã nhận dạng: <strong>{detectedFormat === "meta" ? "Meta Ads" : "Google Ads"}</strong>
              </span>
            </>
          )}
        </div>
      )}

      {previewLines.length > 0 && (
        <details className="text-xs">
          <summary className="cursor-pointer text-muted-foreground hover:text-foreground">
            Xem preview ({previewLines.length - 1} dòng đầu)
          </summary>
          <pre className="bg-secondary/30 rounded-lg p-2 mt-2 overflow-x-auto max-h-40">
            {previewLines.join("\n")}
          </pre>
        </details>
      )}
    </div>
  );
}
