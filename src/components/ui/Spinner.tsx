// 汎用ローディングスピナー。担当ゾーン: 共有。

export interface SpinnerProps {
  label?: string;
}

export function Spinner({ label }: SpinnerProps) {
  return (
    <div role="status" className="flex items-center gap-2 text-sm text-gray-500">
      <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
      {label ? <span>{label}</span> : null}
    </div>
  );
}
