import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { runCommand } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";
import {
  AlertTriangle,
  Database,
  Trash2,
  Phone,
  UserCheck,
  RefreshCw,
  Terminal,
} from "lucide-react";

interface CommandDef {
  id: string;
  label: string;
  description: string;
  icon: React.ReactNode;
  command: string;
  args: string[];
  danger: boolean;
}

const commands: CommandDef[] = [
  {
    id: "delete-gonda",
    label: "Delete Gonda Test Data",
    description: "Remove all Gonda test users and their synthetic data from the database.",
    icon: <Trash2 className="h-4 w-4" />,
    command: "delete_gonda_test_data",
    args: ["--confirm", "--force"],
    danger: true,
  },
  {
    id: "collect-phones",
    label: "List Gonda Users (CSV)",
    description: "Generate a CSV template of all Gonda users with synthetic phone numbers for batch updating.",
    icon: <Phone className="h-4 w-4" />,
    command: "collect_real_phones",
    args: ["--all-gonda", "--output", "-"],
    danger: false,
  },
  {
    id: "assign-patients",
    label: "Auto-Assign Patients",
    description: "Auto-assign unassigned patients to ASHA workers based on geography (village → block).",
    icon: <UserCheck className="h-4 w-4" />,
    command: "auto_assign_patients",
    args: [],
    danger: false,
  },
];

export function Admin() {
  const toast = useToast();
  const [running, setRunning] = useState<string | null>(null);
  const [output, setOutput] = useState<{ command: string; stdout: string; stderr: string } | null>(null);

  async function handleRun(cmd: CommandDef) {
    setRunning(cmd.id);
    setOutput(null);
    try {
      const result = await runCommand(cmd.command, cmd.args);
      setOutput({
        command: `${cmd.command} ${cmd.args.join(" ")}`,
        stdout: result.stdout || "(no output)",
        stderr: result.stderr || "",
      });
      if (result.error) {
        toast.error(`Command failed: ${result.error}`);
      } else {
        toast.success(`${cmd.label} completed`);
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Command failed");
      setOutput({
        command: `${cmd.command} ${cmd.args.join(" ")}`,
        stdout: "",
        stderr: err instanceof Error ? err.message : "Unknown error",
      });
    } finally {
      setRunning(null);
    }
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Admin</h1>
        <p className="text-sm text-slate-500 mt-1">Database management and operational commands</p>
      </div>

      {/* Danger Zone */}
      <Card className="border-red-200">
        <CardHeader className="bg-red-50 rounded-t-lg border-b border-red-100">
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-red-600" />
            <CardTitle className="text-sm font-bold text-red-800">Danger Zone</CardTitle>
          </div>
          <CardDescription className="text-red-600/80 text-xs">
            These actions modify or delete data. Use with caution.
          </CardDescription>
        </CardHeader>
        <CardContent className="p-6">
          <CommandCard cmd={commands[0]} running={running} onRun={handleRun} />
        </CardContent>
      </Card>

      {/* Operations */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Database className="h-5 w-5 text-teal-600" />
            <CardTitle className="text-sm font-bold text-slate-800">Operations</CardTitle>
          </div>
          <CardDescription className="text-xs">
            Routine management tasks
          </CardDescription>
        </CardHeader>
        <CardContent className="p-6 space-y-4">
          {commands.slice(1).map((cmd) => (
            <CommandCard key={cmd.id} cmd={cmd} running={running} onRun={handleRun} />
          ))}
        </CardContent>
      </Card>

      {/* Output Terminal */}
      {output && (
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Terminal className="h-4 w-4 text-slate-500" />
              <CardTitle className="text-sm font-bold text-slate-700">Command Output</CardTitle>
            </div>
            <CardDescription className="text-xs font-mono">{output.command}</CardDescription>
          </CardHeader>
          <CardContent>
            <pre className="bg-slate-950 text-green-400 p-4 rounded-lg text-xs font-mono overflow-x-auto max-h-80 overflow-y-auto">
              {output.stdout}
              {output.stderr && (
                <span className="text-red-400">{output.stderr}</span>
              )}
            </pre>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function CommandCard({
  cmd,
  running,
  onRun,
}: {
  cmd: CommandDef;
  running: string | null;
  onRun: (cmd: CommandDef) => void;
}) {
  const isRunning = running === cmd.id;

  return (
    <div className="flex items-center justify-between p-4 bg-slate-50 rounded-lg border border-slate-100">
      <div className="flex items-start gap-3">
        <div
          className={`p-2 rounded-md ${
            cmd.danger ? "bg-red-100 text-red-600" : "bg-teal-100 text-teal-600"
          }`}
        >
          {cmd.icon}
        </div>
        <div>
          <p className="text-sm font-semibold text-slate-800">{cmd.label}</p>
          <p className="text-xs text-slate-500 mt-0.5">{cmd.description}</p>
          <code className="text-[10px] text-slate-400 mt-1 block">
            {cmd.command} {cmd.args.join(" ")}
          </code>
        </div>
      </div>
      <Button
        variant={cmd.danger ? "destructive" : "default"}
        size="sm"
        disabled={isRunning}
        onClick={() => onRun(cmd)}
      >
        {isRunning ? (
          <>
            <RefreshCw className="h-3 w-3 mr-1 animate-spin" />
            Running...
          </>
        ) : (
          "Run"
        )}
      </Button>
    </div>
  );
}
