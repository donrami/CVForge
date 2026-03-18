import { useState, useCallback, useRef } from 'react';
import { Upload, File, X, Loader2, AlertCircle, CheckCircle } from 'lucide-react';

interface ExtractedCertificate {
  name: string;
  issuer: string;
  issueDate?: string;
  expiryDate?: string;
  credentialId?: string;
  skills: string[];
  activities: string[];
  description?: string;
  confidence: number;
}

interface ExtractionResult {
  filename: string;
  extractionMethod: 'native' | 'ocr';
  pageCount: number;
  ocrConfidence?: number;
  certificate: ExtractedCertificate | null;
  rawText: string;
  error?: string;
}

interface CertificateUploadProps {
  onExtracted: (results: ExtractionResult[]) => void;
}

export function CertificateUpload({ onExtracted }: CertificateUploadProps) {
  const [files, setFiles] = useState<File[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    
    const droppedFiles = Array.from(e.dataTransfer.files).filter(
      file => file.type === 'application/pdf'
    );
    
    if (droppedFiles.length > 0) {
      setFiles(prev => [...prev, ...droppedFiles]);
      setError(null);
    }
  }, []);

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const selectedFiles = Array.from(e.target.files).filter(
        file => file.type === 'application/pdf'
      );
      setFiles(prev => [...prev, ...selectedFiles]);
      setError(null);
    }
  }, []);

  const removeFile = useCallback((index: number) => {
    setFiles(prev => prev.filter((_, i) => i !== index));
  }, []);

  const clearFiles = useCallback(() => {
    setFiles([]);
    setError(null);
  }, []);

  const processFiles = useCallback(async () => {
    if (files.length === 0) return;

    setIsProcessing(true);
    setError(null);

    try {
      const formData = new FormData();
      files.forEach(file => formData.append('files', file));

      const response = await fetch('/api/certificates/extract', {
        method: 'POST',
        body: formData,
        credentials: 'include',
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to process certificates');
      }

      const data = await response.json();
      onExtracted(data.results);
      setFiles([]); // Clear files after successful processing
    } catch (err: any) {
      setError(err.message || 'An error occurred while processing files');
    } finally {
      setIsProcessing(false);
    }
  }, [files, onExtracted]);

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  };

  return (
    <div className="space-y-4">
      {/* Drag and drop zone */}
      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
        className={`
          border-2 border-dashed rounded-lg p-8 text-center cursor-pointer
          transition-colors duration-200
          ${isDragging 
            ? 'border-accent bg-accent/5' 
            : 'border-border hover:border-accent hover:bg-bg-surface'
          }
        `}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept=".pdf"
          multiple
          onChange={handleFileSelect}
          className="hidden"
        />
        <Upload className="mx-auto h-12 w-12 text-text-secondary mb-4" />
        <p className="text-text-primary font-medium">
          Drop PDF certificates here, or click to select
        </p>
        <p className="text-text-secondary text-sm mt-1">
          Supports multiple PDF files (max 10MB each)
        </p>
      </div>

      {/* File list */}
      {files.length > 0 && (
        <div className="bg-bg-surface border border-border rounded-lg p-4 space-y-2">
          <div className="flex justify-between items-center mb-2">
            <span className="text-sm text-text-secondary">
              {files.length} file{files.length !== 1 ? 's' : ''} selected
            </span>
            <button
              onClick={clearFiles}
              className="text-sm text-text-secondary hover:text-accent transition-colors"
            >
              Clear all
            </button>
          </div>
          
          {files.map((file, index) => (
            <div
              key={index}
              className="flex items-center gap-3 bg-bg-base p-3 rounded border border-border"
            >
              <File className="text-accent flex-shrink-0" size={20} />
              <div className="flex-1 min-w-0">
                <p className="text-sm text-text-primary truncate">{file.name}</p>
                <p className="text-xs text-text-secondary">{formatFileSize(file.size)}</p>
              </div>
              <button
                onClick={() => removeFile(index)}
                disabled={isProcessing}
                className="text-text-secondary hover:text-red-500 transition-colors disabled:opacity-50"
              >
                <X size={18} />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Error message */}
      {error && (
        <div className="flex items-center gap-2 text-red-500 text-sm bg-red-500/10 p-3 rounded">
          <AlertCircle size={16} />
          {error}
        </div>
      )}

      {/* Process button */}
      {files.length > 0 && (
        <button
          onClick={processFiles}
          disabled={isProcessing}
          className="w-full flex items-center justify-center gap-2 bg-accent hover:bg-accent-hover text-bg-base font-medium py-3 rounded transition-colors disabled:opacity-50"
        >
          {isProcessing ? (
            <>
              <Loader2 className="animate-spin" size={18} />
              Processing {files.length} file{files.length !== 1 ? 's' : ''}...
            </>
          ) : (
            <>
              <CheckCircle size={18} />
              Process {files.length} Certificate{files.length !== 1 ? 's' : ''}
            </>
          )}
        </button>
      )}
    </div>
  );
}

export type { ExtractionResult, ExtractedCertificate };
