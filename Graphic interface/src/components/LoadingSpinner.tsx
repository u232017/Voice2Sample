export const LoadingSpinner = () => {
  return (
    <div className="flex items-center justify-center gap-4">
      <div className="relative w-12 h-12">
        <div className="absolute inset-0 rounded-full border-4 border-cyan-300/20"></div>
        <div className="absolute inset-0 rounded-full border-4 border-transparent border-r-lime-300 border-t-cyan-300 animate-spin"></div>
      </div>
      <span className="font-semibold text-slate-100">Searching Freesound and loading real previews...</span>
    </div>
  );
};
