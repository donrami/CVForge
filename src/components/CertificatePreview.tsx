import { useState } from 'react';
import { Trash2, AlertTriangle, CheckCircle, Plus, Loader2 } from 'lucide-react';
import type { ExtractionResult } from './CertificateUpload';

interface Certificate {
  id?: string;
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

interface CertificatePreviewProps {
  results: ExtractionResult[];
  onSave: (certificates: Certificate[]) => void;
  onCancel: () => void;
  saving?: boolean;
}

export function CertificatePreview({ results, onSave, onCancel, saving = false }: CertificatePreviewProps) {
  const [certificates, setCertificates] = useState<Certificate[]>(() => {
    // Convert extraction results to editable certificates
    return results
      .filter(r => r.certificate !== null)
      .map(r => ({
        ...r.certificate!,
      }));
  });

  const failedExtractions = results.filter(r => r.certificate === null || r.error);

  const updateCertificate = (index: number, field: keyof Certificate, value: any) => {
    setCertificates(prev =>
      prev.map((cert, i) =>
        i === index ? { ...cert, [field]: value } : cert
      )
    );
  };

  const updateSkill = (certIndex: number, skillIndex: number, value: string) => {
    setCertificates(prev =>
      prev.map((cert, i) =>
        i === certIndex
          ? {
              ...cert,
              skills: cert.skills.map((s, j) => (j === skillIndex ? value : s)),
            }
          : cert
      )
    );
  };

  const addSkill = (certIndex: number) => {
    setCertificates(prev =>
      prev.map((cert, i) =>
        i === certIndex ? { ...cert, skills: [...cert.skills, ''] } : cert
      )
    );
  };

  const removeSkill = (certIndex: number, skillIndex: number) => {
    setCertificates(prev =>
      prev.map((cert, i) =>
        i === certIndex
          ? { ...cert, skills: cert.skills.filter((_, j) => j !== skillIndex) }
          : cert
      )
    );
  };

  const updateActivity = (certIndex: number, activityIndex: number, value: string) => {
    setCertificates(prev =>
      prev.map((cert, i) =>
        i === certIndex
          ? {
              ...cert,
              activities: cert.activities.map((a, j) => (j === activityIndex ? value : a)),
            }
          : cert
      )
    );
  };

  const addActivity = (certIndex: number) => {
    setCertificates(prev =>
      prev.map((cert, i) =>
        i === certIndex ? { ...cert, activities: [...cert.activities, ''] } : cert
      )
    );
  };

  const removeActivity = (certIndex: number, activityIndex: number) => {
    setCertificates(prev =>
      prev.map((cert, i) =>
        i === certIndex
          ? { ...cert, activities: cert.activities.filter((_, j) => j !== activityIndex) }
          : cert
      )
    );
  };

  const removeCertificate = (index: number) => {
    setCertificates(prev => prev.filter((_, i) => i !== index));
  };

  const addEmptyCertificate = () => {
    setCertificates(prev => [
      ...prev,
      {
        name: '',
        issuer: '',
        issueDate: '',
        expiryDate: '',
        credentialId: '',
        skills: [],
        activities: [],
        description: '',
        confidence: 1,
      },
    ]);
  };

  const getConfidenceColor = (confidence: number) => {
    if (confidence >= 0.8) return 'text-green-500';
    if (confidence >= 0.5) return 'text-yellow-500';
    return 'text-red-500';
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-serif text-text-primary">
            Extracted Certificates ({certificates.length})
          </h3>
          {failedExtractions.length > 0 && (
            <p className="text-sm text-text-secondary">
              {failedExtractions.length} file(s) could not be processed
            </p>
          )}
        </div>
        <button
          onClick={addEmptyCertificate}
          className="flex items-center gap-2 text-sm text-accent hover:text-accent-hover transition-colors"
        >
          <Plus size={16} />
          Add Manually
        </button>
      </div>

      {/* Failed extractions warning */}
      {failedExtractions.length > 0 && (
        <div className="bg-yellow-500/10 border border-yellow-500/30 rounded p-4">
          <div className="flex items-start gap-3">
            <AlertTriangle className="text-yellow-500 flex-shrink-0" size={20} />
            <div className="flex-1">
              <p className="text-sm text-text-primary font-medium">
                Some files could not be processed
              </p>
              <ul className="mt-2 space-y-1">
                {failedExtractions.map((result, i) => (
                  <li key={i} className="text-sm text-text-secondary">
                    • {result.filename}: {result.error || 'Could not extract certificate data'}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      )}

      {/* Certificate forms */}
      {certificates.length === 0 ? (
        <div className="text-center py-8 text-text-secondary">
          No certificates extracted. Try uploading different files or add manually.
        </div>
      ) : (
        <div className="space-y-4">
          {certificates.map((cert, index) => (
            <div
              key={index}
              className="bg-bg-surface border border-border rounded-lg p-6 space-y-4"
            >
              {/* Certificate header */}
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-2">
                  <span className={`text-sm ${getConfidenceColor(cert.confidence)}`}>
                    {cert.confidence >= 0.8 ? (
                      <CheckCircle size={16} className="inline mr-1" />
                    ) : cert.confidence >= 0.5 ? (
                      <AlertTriangle size={16} className="inline mr-1" />
                    ) : (
                      <AlertTriangle size={16} className="inline mr-1" />
                    )}
                    {Math.round(cert.confidence * 100)}% confidence
                  </span>
                </div>
                <button
                  onClick={() => removeCertificate(index)}
                  className="text-text-secondary hover:text-red-500 transition-colors"
                >
                  <Trash2 size={18} />
                </button>
              </div>

              {/* Form fields */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm text-text-secondary mb-1">
                    Certificate Name *
                  </label>
                  <input
                    type="text"
                    value={cert.name}
                    onChange={e => updateCertificate(index, 'name', e.target.value)}
                    placeholder="e.g., AWS Certified Solutions Architect"
                    className="w-full bg-bg-base border border-border rounded px-3 py-2 text-text-primary focus:outline-none focus:border-accent"
                  />
                </div>

                <div>
                  <label className="block text-sm text-text-secondary mb-1">
                    Issuer/Organization *
                  </label>
                  <input
                    type="text"
                    value={cert.issuer}
                    onChange={e => updateCertificate(index, 'issuer', e.target.value)}
                    placeholder="e.g., Amazon Web Services"
                    className="w-full bg-bg-base border border-border rounded px-3 py-2 text-text-primary focus:outline-none focus:border-accent"
                  />
                </div>

                <div>
                  <label className="block text-sm text-text-secondary mb-1">
                    Issue Date
                  </label>
                  <input
                    type="text"
                    value={cert.issueDate || ''}
                    onChange={e => updateCertificate(index, 'issueDate', e.target.value)}
                    placeholder="e.g., May 2023"
                    className="w-full bg-bg-base border border-border rounded px-3 py-2 text-text-primary focus:outline-none focus:border-accent"
                  />
                </div>

                <div>
                  <label className="block text-sm text-text-secondary mb-1">
                    Expiry Date
                  </label>
                  <input
                    type="text"
                    value={cert.expiryDate || ''}
                    onChange={e => updateCertificate(index, 'expiryDate', e.target.value)}
                    placeholder="e.g., May 2026 (leave empty if no expiry)"
                    className="w-full bg-bg-base border border-border rounded px-3 py-2 text-text-primary focus:outline-none focus:border-accent"
                  />
                </div>

                <div className="md:col-span-2">
                  <label className="block text-sm text-text-secondary mb-1">
                    Credential ID
                  </label>
                  <input
                    type="text"
                    value={cert.credentialId || ''}
                    onChange={e => updateCertificate(index, 'credentialId', e.target.value)}
                    placeholder="e.g., AWS-123456789"
                    className="w-full bg-bg-base border border-border rounded px-3 py-2 text-text-primary focus:outline-none focus:border-accent"
                  />
                </div>

                <div className="md:col-span-2">
                  <label className="block text-sm text-text-secondary mb-1">
                    Description
                  </label>
                  <textarea
                    value={cert.description || ''}
                    onChange={e => updateCertificate(index, 'description', e.target.value)}
                    placeholder="Brief description of what this certification validates..."
                    rows={2}
                    className="w-full bg-bg-base border border-border rounded px-3 py-2 text-text-primary focus:outline-none focus:border-accent resize-y"
                  />
                </div>

                {/* Skills */}
                <div className="md:col-span-2">
                  <label className="block text-sm text-text-secondary mb-2">
                    Skills/Topics Covered
                  </label>
                  <div className="flex flex-wrap gap-2">
                    {cert.skills.map((skill, skillIndex) => (
                      <div
                        key={skillIndex}
                        className="flex items-center gap-1 bg-bg-base border border-border rounded px-2 py-1"
                      >
                        <input
                          type="text"
                          value={skill}
                          onChange={e => updateSkill(index, skillIndex, e.target.value)}
                          placeholder="Skill"
                          className="bg-transparent text-sm text-text-primary focus:outline-none w-24"
                        />
                        <button
                          onClick={() => removeSkill(index, skillIndex)}
                          className="text-text-secondary hover:text-red-500"
                        >
                          ×
                        </button>
                      </div>
                    ))}
                    <button
                      onClick={() => addSkill(index)}
                      className="text-sm text-accent hover:text-accent-hover border border-dashed border-accent/50 rounded px-3 py-1 transition-colors"
                    >
                      + Add Skill
                    </button>
                  </div>
                </div>

                {/* Activities (for work certificates) */}
                {cert.activities && cert.activities.length > 0 && (
                  <div className="md:col-span-2">
                    <label className="block text-sm text-text-secondary mb-2">
                      Work Activities/Responsibilities
                    </label>
                    <div className="space-y-2">
                      {cert.activities.map((activity, activityIndex) => (
                        <div
                          key={activityIndex}
                          className="flex items-center gap-2"
                        >
                          <input
                            type="text"
                            value={activity}
                            onChange={e => updateActivity(index, activityIndex, e.target.value)}
                            placeholder="e.g., Developed REST APIs for customer portal"
                            className="flex-1 bg-bg-base border border-border rounded px-3 py-2 text-sm text-text-primary focus:outline-none focus:border-accent"
                          />
                          <button
                            onClick={() => removeActivity(index, activityIndex)}
                            className="text-text-secondary hover:text-red-500 flex-shrink-0"
                          >
                            ×
                          </button>
                        </div>
                      ))}
                      <button
                        onClick={() => addActivity(index)}
                        className="text-sm text-accent hover:text-accent-hover border border-dashed border-accent/50 rounded px-3 py-1 transition-colors"
                      >
                        + Add Activity
                      </button>
                    </div>
                  </div>
                )}
                {cert.activities && cert.activities.length === 0 && (
                  <div className="md:col-span-2">
                    <button
                      onClick={() => addActivity(index)}
                      className="text-sm text-text-secondary hover:text-accent transition-colors"
                    >
                      + Add work activities (for work certificates)
                    </button>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Actions */}
      <div className="flex justify-end gap-4 pt-4 border-t border-border">
        <button
          onClick={onCancel}
          disabled={saving}
          className="px-6 py-2 text-text-secondary hover:text-text-primary transition-colors disabled:opacity-50"
        >
          Cancel
        </button>
        <button
          onClick={() => onSave(certificates)}
          disabled={saving || certificates.length === 0}
          className="flex items-center gap-2 bg-accent hover:bg-accent-hover text-bg-base font-medium px-6 py-2 rounded transition-colors disabled:opacity-50"
        >
          {saving ? (
            <>
              <Loader2 className="animate-spin" size={18} />
              Saving...
            </>
          ) : (
            <>
              <CheckCircle size={18} />
              Save {certificates.length} Certificate{certificates.length !== 1 ? 's' : ''}
            </>
          )}
        </button>
      </div>
    </div>
  );
}

export type { Certificate };
