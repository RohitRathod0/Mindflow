const SkeletonCard = () => (
  <div className="rounded-2xl bg-[#1e1e38] border border-[rgba(255,255,255,0.04)] p-4 space-y-3 animate-pulse">
    <div className="flex items-center gap-3">
      <div className="w-8 h-8 rounded-xl bg-[#2a2a48]" />
      <div className="flex-1 space-y-2">
        <div className="h-3 bg-[#2a2a48] rounded-full w-3/4" />
        <div className="h-2 bg-[#2a2a48] rounded-full w-1/2" />
      </div>
      <div className="w-16 h-6 bg-[#2a2a48] rounded-full" />
    </div>
  </div>
);
export default SkeletonCard;
