// TimelinePendingNode - 待执行任务节点
export interface TimelinePendingNodeProps {
  path: string;
}

export function TimelinePendingNode({ path }: TimelinePendingNodeProps) {
  return (
    <div className="group flex gap-4 relative opacity-40">
      <div className="w-6 h-6 rounded-full bg-transparent flex items-center justify-center shrink-0 z-10 relative mt-0.5">
        <div className="w-1.5 h-1.5 rounded-full bg-zinc-600" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mt-1.5">
          <span className="text-xs font-mono font-medium text-zinc-500">{path}</span>
          <span className="text-[11px] text-zinc-600">Pending</span>
        </div>
      </div>
    </div>
  );
}
