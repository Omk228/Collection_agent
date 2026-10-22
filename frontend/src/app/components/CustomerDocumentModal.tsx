import React, { useState } from 'react';
import { resolveSecureDocUrl } from '../services/api';
import { 
  X, 
  Download, 
  ExternalLink, 
  Copy, 
  Check, 
  ShieldCheck, 
  Lock, 
  FileText, 
  Image as ImageIcon,
  AlertTriangle
} from 'lucide-react';
import { toast } from 'sonner@2.0.3';
import { Badge } from './ui/badge';
import { Button } from './ui/button';

export interface CustomerDocument {
  id: string | number;
  name: string;
  docType?: string;
  fileName: string;
  filePath?: string;
  fileUrl?: string;
  url?: string;
  downloadUrl?: string;
  filePassword?: string | null;
  uploadedBy?: string;
  tamperStatus?: string;
  tamperAnalysis?: string;
  panelStatus?: string;
  status?: string;
  isVerified?: boolean;
  isImage?: boolean;
  isPdf?: boolean;
  isVideo?: boolean;
  isAudio?: boolean;
  fileFormat?: string;
  uploadedAt?: string;
  uploadedTime?: string;
}

interface CustomerDocumentModalProps {
  document: CustomerDocument | null;
  onClose: () => void;
}

export function CustomerDocumentModal({ document, onClose }: CustomerDocumentModalProps) {
  const [copiedPassword, setCopiedPassword] = useState(false);
  const [imageLoaded, setImageLoaded] = useState(false);

  if (!document) return null;

  const rawUrl = document.fileUrl || document.url || document.filePath || '';
  const secureUrl = resolveSecureDocUrl(rawUrl);

  const handleCopyPassword = () => {
    if (!document.filePassword) return;
    navigator.clipboard.writeText(document.filePassword);
    setCopiedPassword(true);
    toast.success('Password copied to clipboard!');
    setTimeout(() => setCopiedPassword(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-[10005] bg-black/85 backdrop-blur-md flex items-center justify-center p-3 md:p-6 animate-in fade-in duration-200">
      <div className="bg-slate-900 border border-slate-800 text-slate-100 rounded-2xl w-full max-w-4xl p-4 md:p-5 flex flex-col max-h-[92vh] shadow-2xl overflow-hidden">
        
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-800/80 pb-3 gap-2">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-slate-800 border border-slate-700/80 flex items-center justify-center text-primary flex-shrink-0">
              {document.isPdf ? (
                <FileText className="w-5 h-5 text-rose-400" />
              ) : document.isImage ? (
                <ImageIcon className="w-5 h-5 text-blue-400" />
              ) : (
                <FileText className="w-5 h-5 text-amber-400" />
              )}
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="font-bold text-base text-white tracking-tight">{document.name}</h3>
                <Badge variant="outline" className="text-[10px] bg-slate-800 border-slate-700 text-slate-300">
                  {document.fileFormat || 'DOCUMENT'}
                </Badge>
                {document.panelStatus === 'VERIFIED' && (
                  <Badge variant="outline" className="text-[10px] bg-emerald-500/10 text-emerald-400 border-emerald-500/30">
                    VERIFIED
                  </Badge>
                )}
              </div>
              <p className="text-xs text-slate-400 font-mono mt-0.5 truncate max-w-md">
                {document.fileName} • {document.uploadedAt} {document.uploadedTime ? `at ${document.uploadedTime}` : ''}
              </p>
            </div>
          </div>

          <button 
            onClick={onClose}
            className="p-2 rounded-xl bg-slate-800/80 hover:bg-slate-700 text-slate-400 hover:text-white transition-colors"
            title="Close viewer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Password Notice Banner (e.g., for Bank Statement / Payslip) */}
        {document.filePassword && (
          <div className="mt-3 p-3 bg-amber-500/10 border border-amber-500/30 rounded-xl text-amber-300 text-xs flex items-center justify-between font-mono gap-2">
            <div className="flex items-center gap-2">
              <Lock className="w-4 h-4 text-amber-400 flex-shrink-0" />
              <span>
                Document Protected: Password is <strong className="text-amber-200 bg-amber-500/20 px-1.5 py-0.5 rounded">{document.filePassword}</strong>
              </span>
            </div>
            <button 
              onClick={handleCopyPassword}
              className="px-2.5 py-1 bg-amber-500/20 hover:bg-amber-500/30 text-amber-200 rounded-md transition-colors flex items-center gap-1 font-sans text-xs"
            >
              {copiedPassword ? (
                <>
                  <Check className="w-3.5 h-3.5 text-emerald-400" />
                  <span className="text-emerald-400">Copied</span>
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5" />
                  <span>Copy</span>
                </>
              )}
            </button>
          </div>
        )}

        {/* Tamper Analysis Banner */}
        {document.tamperAnalysis && (
          <div className="mt-2 px-3 py-1.5 bg-slate-800/60 rounded-lg text-[11px] text-slate-300 flex items-center justify-between border border-slate-700/50">
            <div className="flex items-center gap-1.5">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
              <span>Audit: {document.tamperAnalysis}</span>
            </div>
            <span className="text-emerald-400 font-semibold">{document.tamperStatus || 'ORIGINAL'}</span>
          </div>
        )}

        {/* Viewer Content Area */}
        <div className="flex-1 overflow-auto my-3 flex items-center justify-center bg-slate-950 rounded-xl p-2 min-h-[420px] max-h-[60vh] border border-slate-800/60 relative">
          {document.isPdf ? (
            <iframe 
              src={`${secureUrl}#toolbar=0`} 
              title={document.name} 
              className="w-full h-full min-h-[420px] rounded-lg border-0 bg-white" 
            />
          ) : document.isImage ? (
            <div className="relative flex items-center justify-center w-full h-full">
              {!imageLoaded && (
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                </div>
              )}
              <img 
                src={secureUrl} 
                alt={document.name} 
                onLoad={() => setImageLoaded(true)}
                onError={() => setImageLoaded(true)}
                className={`max-h-[520px] max-w-full object-contain rounded-lg transition-opacity duration-200 ${imageLoaded ? 'opacity-100' : 'opacity-0'}`} 
              />
            </div>
          ) : (
            <div className="text-center p-8 space-y-3">
              <div className="w-14 h-14 rounded-2xl bg-slate-900 border border-slate-800 flex items-center justify-center mx-auto text-slate-400">
                <FileText className="w-7 h-7" />
              </div>
              <p className="text-sm text-slate-300">
                Direct in-app preview is not available for <span className="font-mono text-amber-400 font-semibold">{document.fileFormat}</span> files.
              </p>
              <p className="text-xs text-slate-500 max-w-xs mx-auto">
                You can download the original file to view it securely on your device.
              </p>
              <a 
                href={secureUrl} 
                download={document.fileName} 
                className="inline-flex items-center gap-1.5 px-4 py-2 bg-primary text-primary-foreground rounded-lg text-xs font-semibold hover:opacity-90 transition-opacity"
              >
                <Download className="w-4 h-4" />
                Download File
              </a>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="flex items-center justify-between pt-2 border-t border-slate-800/80 text-xs">
          <div className="flex items-center gap-1.5 text-emerald-400 font-medium">
            <ShieldCheck className="w-4 h-4" />
            <span>Encrypted zero-trust token stream</span>
          </div>

          <div className="flex items-center gap-2">
            <a 
              href={secureUrl} 
              target="_blank" 
              rel="noopener noreferrer" 
              className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white rounded-lg font-semibold transition-colors flex items-center gap-1.5"
            >
              <ExternalLink className="w-3.5 h-3.5" />
              <span>Open in New Tab</span>
            </a>
            <a 
              href={secureUrl} 
              download={document.fileName} 
              className="px-3.5 py-1.5 bg-primary text-primary-foreground hover:opacity-90 rounded-lg font-semibold transition-opacity flex items-center gap-1.5"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Download</span>
            </a>
          </div>
        </div>

      </div>
    </div>
  );
}

export default CustomerDocumentModal;
