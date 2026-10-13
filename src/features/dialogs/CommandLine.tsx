import { TechnicalLabel } from "@/components/ui/Panel";

/** Shows the Git command that a form will run. */
export function CommandLine({ label = "Command", command }: { label?: string; command: string }) {
  return (
    <div className="border border-line bg-base p-3">
      <TechnicalLabel>{label}</TechnicalLabel>
      <div className="mono selectable mt-1.5 break-all text-[12px] text-ink">
        <span className="text-cyan">$ </span>
        {command}
      </div>
    </div>
  );
}
