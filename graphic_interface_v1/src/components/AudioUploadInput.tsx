import React, { useRef, useState } from 'react';
import { FileAudio, Upload } from 'lucide-react';

interface AudioUploadInputProps {
  onFileSelected: (file: File) => void;
  isLoading?: boolean;
}

export const AudioUploadInput: React.FC<AudioUploadInputProps> = ({ onFileSelected, isLoading }) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);

  const submitFile = (file?: File) => {
    if (file) {
      onFileSelected(file);
    }
  };

  const handleDrop = (event: React.DragEvent) => {
    event.preventDefault();
    setIsDragging(false);
    submitFile(event.dataTransfer.files[0]);
  };

  return (
    <div
      onDragOver={(event) => {
        event.preventDefault();
        setIsDragging(true);
      }}
      onDragLeave={() => setIsDragging(false)}
      onDrop={handleDrop}
      className={`upload-zone ${isDragging ? 'upload-zone-active' : ''}`}
      onClick={() => fileInputRef.current?.click()}
      role="button"
      tabIndex={0}
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          fileInputRef.current?.click();
        }
      }}
    >
      <input
        ref={fileInputRef}
        type="file"
        accept="audio/*"
        onChange={(event) => submitFile(event.target.files?.[0])}
        disabled={isLoading}
        className="hidden"
      />

      <div className="grid h-14 w-14 place-items-center rounded-lg bg-cyan-300 text-slate-950">
        {isLoading ? <Upload className="h-7 w-7 animate-pulse" /> : <FileAudio className="h-7 w-7" />}
      </div>
      <div>
        <p className="text-lg font-bold text-white">Drop an audio file here</p>
        <p className="mt-1 text-sm text-slate-300">or click to choose WAV, MP3, OGG, FLAC or M4A</p>
      </div>
    </div>
  );
};
