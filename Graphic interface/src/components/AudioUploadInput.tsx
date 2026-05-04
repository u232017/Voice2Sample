import React, { useRef, useState } from 'react';
import { Upload, Mic } from 'lucide-react';

interface AudioUploadInputProps {
  onFileSelected: (file: File) => void;
  isLoading?: boolean;
}

export const AudioUploadInput: React.FC<AudioUploadInputProps> = ({ onFileSelected, isLoading }) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);

    const files = e.dataTransfer.files;
    if (files.length > 0) {
      onFileSelected(files[0]);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      onFileSelected(e.target.files[0]);
    }
  };

  return (
    <div
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      className={`relative p-8 rounded-lg border-2 border-dashed transition-all cursor-pointer ${
        isDragging
          ? 'border-freesound-yellow bg-freesound-yellow/10'
          : 'border-freesound-yellow/30 bg-freesound-yellow/5 hover:bg-freesound-yellow/10'
      }`}
      onClick={() => fileInputRef.current?.click()}
    >
      <input
        ref={fileInputRef}
        type="file"
        accept="audio/*"
        onChange={handleFileChange}
        disabled={isLoading}
        className="hidden"
      />

      <div className="flex flex-col items-center gap-2 pointer-events-none">
        <Upload className="w-8 h-8 text-freesound-yellow/70" />
        <div className="text-center">
          <p className="font-semibold text-white">Arrastra tu archivo aquí</p>
          <p className="text-sm text-freesound-yellow/60">o haz clic para seleccionar</p>
        </div>
        <p className="text-xs text-freesound-yellow/40 mt-2">
          WAV, MP3, OGG, FLAC (máx 50MB)
        </p>
      </div>
    </div>
  );
};
