import { useEffect, useState } from "react";
import { Minus, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

interface NumberSettingInputProps {
  label: string;
  value: number | null;
  onChange: (value: number | null) => void;
  min?: number;
  max?: number;
  step?: number;
  suffix?: string;
  disabled?: boolean;
  error?: string;
}

function clamp(value: number, min?: number, max?: number) {
  if (typeof min === "number" && value < min) return min;
  if (typeof max === "number" && value > max) return max;
  return value;
}

export function NumberSettingInput({
  label,
  value,
  onChange,
  min,
  max,
  step = 1,
  suffix,
  disabled,
  error,
}: NumberSettingInputProps) {
  const [text, setText] = useState(value === null || value === undefined ? "" : String(value));

  useEffect(() => {
    setText(value === null || value === undefined ? "" : String(value));
  }, [value]);

  const commit = (raw: string) => {
    if (raw.trim() === "") {
      setText("");
      onChange(null);
      return;
    }

    const parsed = Number(raw);
    if (!Number.isFinite(parsed)) {
      setText(value === null || value === undefined ? "" : String(value));
      return;
    }

    const next = clamp(parsed, min, max);
    setText(String(next));
    onChange(next);
  };

  const nudge = (direction: -1 | 1) => {
    const current = Number.isFinite(Number(text)) ? Number(text) : (value ?? min ?? 0);
    const next = clamp(current + direction * step, min, max);
    setText(String(next));
    onChange(next);
  };

  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      <div className="flex min-w-0 items-center gap-2">
        <Button
          type="button"
          variant="outline"
          size="icon"
          disabled={disabled || (typeof min === "number" && (value ?? min) <= min)}
          onClick={() => nudge(-1)}
          className="h-10 w-10 shrink-0 rounded-xl"
        >
          <Minus className="h-4 w-4" />
        </Button>
        <Input
          type="text"
          inputMode="numeric"
          pattern="[0-9]*"
          value={text}
          disabled={disabled}
          onChange={(event) => {
            const next = event.target.value.replace(/[^\d]/g, "");
            setText(next);
            if (next === "") {
              onChange(null);
              return;
            }
            const parsed = Number(next);
            if (Number.isFinite(parsed)) onChange(parsed);
          }}
          onBlur={() => commit(text)}
          className={cn("min-w-0 rounded-xl text-center", error && "border-destructive focus-visible:ring-destructive")}
        />
        <Button
          type="button"
          variant="outline"
          size="icon"
          disabled={disabled || (typeof max === "number" && (value ?? max) >= max)}
          onClick={() => nudge(1)}
          className="h-10 w-10 shrink-0 rounded-xl"
        >
          <Plus className="h-4 w-4" />
        </Button>
        {suffix && (
          <span className="min-w-10 shrink-0 text-sm text-muted-foreground">
            {suffix}
          </span>
        )}
      </div>
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}
