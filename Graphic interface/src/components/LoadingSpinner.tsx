export const LoadingSpinner = () => {
  return (
    <div className="flex items-center justify-center gap-3">
      <div className="relative w-12 h-12">
        <div className="absolute inset-0 rounded-full border-4 border-freesound-yellow/20"></div>
        <div className="absolute inset-0 rounded-full border-4 border-transparent border-t-freesound-yellow border-r-freesound-orange animate-spin"></div>
      </div>
      <span className="text-freesound-yellow font-medium">Buscando sonidos similares...</span>
    </div>
  );
};
