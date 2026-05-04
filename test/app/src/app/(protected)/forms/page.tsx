"use client";

import { Check, Eye, EyeOff, Upload } from "lucide-react";
import { type ChangeEvent, type DragEvent, type FormEvent, useRef, useState } from "react";

const MULTI_OPTIONS = [
  { value: "react", label: "React" },
  { value: "vue", label: "Vue" },
  { value: "angular", label: "Angular" },
  { value: "svelte", label: "Svelte" },
  { value: "nextjs", label: "Next.js" },
];

const RADIO_OPTIONS = [
  { value: "beginner", label: "Beginner" },
  { value: "intermediate", label: "Intermediate" },
  { value: "advanced", label: "Advanced" },
  { value: "expert", label: "Expert" },
];

interface FormResult {
  success: boolean;
  submitted: Record<string, unknown>;
  receivedAt: string;
  fieldCount: number;
}

export default function FormsPage() {
  const [showPassword, setShowPassword] = useState(false);
  const [sliderValue, setSliderValue] = useState(50);
  const [toggleValue, setToggleValue] = useState(false);
  const [selectedMulti, setSelectedMulti] = useState<string[]>([]);
  const [selectedRadio, setSelectedRadio] = useState("");
  const [uploadedFiles, setUploadedFiles] = useState<string[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [submitResult, setSubmitResult] = useState<FormResult | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const formRef = useRef<HTMLFormElement>(null);

  function handleMultiToggle(value: string) {
    setSelectedMulti((prev) =>
      prev.includes(value) ? prev.filter((v) => v !== value) : [...prev, value],
    );
  }

  function handleFileDrop(e: DragEvent<HTMLDivElement>) {
    e.preventDefault();
    setIsDragging(false);
    const files = Array.from(e.dataTransfer.files).map((f) => f.name);
    setUploadedFiles((prev) => [...prev, ...files]);
  }

  function handleFileInput(e: ChangeEvent<HTMLInputElement>) {
    if (!e.target.files) return;
    const files = Array.from(e.target.files).map((f) => f.name);
    setUploadedFiles((prev) => [...prev, ...files]);
  }

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSubmitting(true);
    const fd = new FormData(e.currentTarget);
    const data: Record<string, unknown> = {};
    fd.forEach((val, key) => {
      data[key] = val;
    });
    data["frameworks"] = selectedMulti;
    data["level"] = selectedRadio;
    data["notifications"] = toggleValue;
    data["satisfaction"] = sliderValue;

    try {
      const res = await fetch("/api/form", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      const result = await res.json();
      setSubmitResult(result);
    } catch {
      setSubmitResult(null);
    } finally {
      setSubmitting(false);
    }
  }

  function handleReset() {
    setSubmitResult(null);
    setShowPassword(false);
    setSliderValue(50);
    setToggleValue(false);
    setSelectedMulti([]);
    setSelectedRadio("");
    setUploadedFiles([]);
    formRef.current?.reset();
  }

  const inputClass =
    "w-full px-3 py-2.5 bg-zinc-800 border border-zinc-700 rounded-lg text-sm text-zinc-100 placeholder:text-zinc-600 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-colors";
  const labelClass = "block text-xs font-medium text-zinc-400 mb-1.5";

  return (
    <div data-testid="forms-page" aria-label="Forms test page">
      <h1 className="text-2xl font-bold text-zinc-100 mb-1">Forms</h1>
      <p className="text-sm text-zinc-500 mb-8">
        Comprehensive form controls for browser automation testing.
      </p>

      <form
        ref={formRef}
        onSubmit={handleSubmit}
        noValidate
        data-testid="main-form"
        aria-label="Main test form"
        className="space-y-6"
      >
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Text inputs */}
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5 card-glow space-y-4">
            <h2 className="text-sm font-semibold text-zinc-200">Text Inputs</h2>

            <div>
              <label htmlFor="full-name" className={labelClass}>
                Full name
              </label>
              <input
                id="full-name"
                type="text"
                name="fullName"
                data-testid="input-name"
                aria-label="Full name"
                placeholder="John Doe"
                className={inputClass}
              />
            </div>

            <div>
              <label htmlFor="email-input" className={labelClass}>
                Email address
              </label>
              <input
                id="email-input"
                type="email"
                name="email"
                data-testid="input-email"
                aria-label="Email address"
                placeholder="you@example.com"
                className={inputClass}
              />
            </div>

            <div>
              <label htmlFor="phone" className={labelClass}>
                Phone number
              </label>
              <input
                id="phone"
                type="tel"
                name="phone"
                data-testid="input-phone"
                aria-label="Phone number"
                placeholder="+1 (555) 000-0000"
                className={inputClass}
              />
            </div>

            <div>
              <label htmlFor="website" className={labelClass}>
                Website URL
              </label>
              <input
                id="website"
                type="url"
                name="website"
                data-testid="input-url"
                aria-label="Website URL"
                placeholder="https://example.com"
                className={inputClass}
              />
            </div>

            <div>
              <label htmlFor="age" className={labelClass}>
                Age
              </label>
              <input
                id="age"
                type="number"
                name="age"
                data-testid="input-number"
                aria-label="Age"
                placeholder="25"
                min={1}
                max={120}
                className={inputClass}
              />
            </div>

            <div>
              <label htmlFor="birth-date" className={labelClass}>
                Birth date
              </label>
              <input
                id="birth-date"
                type="date"
                name="birthDate"
                data-testid="input-date"
                aria-label="Birth date"
                className={inputClass + " [color-scheme:dark]"}
              />
            </div>
          </div>

          {/* Password + Textarea + Select */}
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5 card-glow space-y-4">
            <h2 className="text-sm font-semibold text-zinc-200">Advanced Inputs</h2>

            {/* Password with toggle */}
            <div>
              <label htmlFor="password-field" className={labelClass}>
                Password
              </label>
              <div className="relative">
                <input
                  id="password-field"
                  type={showPassword ? "text" : "password"}
                  name="password"
                  data-testid="input-password"
                  aria-label="Password"
                  placeholder="••••••••"
                  className={inputClass + " pr-10"}
                />
                <button
                  type="button"
                  data-testid="toggle-password"
                  aria-label={showPassword ? "Hide password" : "Show password"}
                  onClick={() => setShowPassword((v) => !v)}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-300 transition-colors"
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            {/* Textarea */}
            <div>
              <label htmlFor="bio" className={labelClass}>
                Bio
              </label>
              <textarea
                id="bio"
                name="bio"
                data-testid="input-textarea"
                aria-label="Bio"
                placeholder="Tell us about yourself..."
                rows={4}
                className={inputClass + " resize-y min-h-[80px]"}
              />
            </div>

            {/* Select */}
            <div>
              <label htmlFor="country" className={labelClass}>
                Country
              </label>
              <select
                id="country"
                name="country"
                data-testid="input-select"
                aria-label="Country"
                className={inputClass}
              >
                <option value="">Select a country…</option>
                <option value="us">United States</option>
                <option value="uk">United Kingdom</option>
                <option value="ca">Canada</option>
                <option value="au">Australia</option>
                <option value="cn">China</option>
                <option value="jp">Japan</option>
                <option value="de">Germany</option>
                <option value="fr">France</option>
              </select>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Multi-select checkboxes */}
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5 card-glow">
            <h2 className="text-sm font-semibold text-zinc-200 mb-4">Frameworks (multi-select)</h2>
            <fieldset>
              <legend className="sr-only">Select frameworks</legend>
              <div className="space-y-2" role="group" aria-label="Framework checkboxes">
                {MULTI_OPTIONS.map((opt) => (
                  <label
                    key={opt.value}
                    className="flex items-center gap-3 p-2.5 rounded-lg hover:bg-zinc-800 cursor-pointer transition-colors"
                    data-testid={`checkbox-${opt.value}`}
                  >
                    <input
                      type="checkbox"
                      value={opt.value}
                      aria-label={opt.label}
                      checked={selectedMulti.includes(opt.value)}
                      onChange={() => handleMultiToggle(opt.value)}
                      className="w-4 h-4 rounded border-zinc-600 bg-zinc-800 accent-indigo-600 cursor-pointer"
                    />
                    <span className="text-sm text-zinc-300">{opt.label}</span>
                    {selectedMulti.includes(opt.value) && (
                      <Check size={14} className="text-indigo-400 ml-auto" aria-hidden="true" />
                    )}
                  </label>
                ))}
              </div>
            </fieldset>
            <div
              className="mt-2 text-xs text-zinc-500"
              data-testid="multi-selected"
              aria-live="polite"
            >
              Selected: {selectedMulti.length > 0 ? selectedMulti.join(", ") : "none"}
            </div>
          </div>

          {/* Radio group */}
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5 card-glow">
            <h2 className="text-sm font-semibold text-zinc-200 mb-4">Experience Level (radio)</h2>
            <fieldset>
              <legend className="sr-only">Select experience level</legend>
              <div className="space-y-2" role="radiogroup" aria-label="Experience level">
                {RADIO_OPTIONS.map((opt) => (
                  <label
                    key={opt.value}
                    className="flex items-center gap-3 p-2.5 rounded-lg hover:bg-zinc-800 cursor-pointer transition-colors"
                    data-testid={`radio-${opt.value}`}
                  >
                    <input
                      type="radio"
                      name="level"
                      value={opt.value}
                      aria-label={opt.label}
                      checked={selectedRadio === opt.value}
                      onChange={() => setSelectedRadio(opt.value)}
                      className="w-4 h-4 border-zinc-600 bg-zinc-800 accent-indigo-600 cursor-pointer"
                    />
                    <span className="text-sm text-zinc-300">{opt.label}</span>
                  </label>
                ))}
              </div>
            </fieldset>
            <div
              className="mt-2 text-xs text-zinc-500"
              data-testid="radio-selected"
              aria-live="polite"
            >
              Selected: {selectedRadio || "none"}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Slider + Toggle */}
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5 card-glow space-y-6">
            <h2 className="text-sm font-semibold text-zinc-200">Range & Toggle</h2>

            <div>
              <div className="flex items-center justify-between mb-2">
                <label htmlFor="satisfaction" className={labelClass + " mb-0"}>
                  Satisfaction
                </label>
                <span
                  className="text-sm font-bold text-indigo-400 tabular-nums"
                  data-testid="slider-value"
                  aria-live="polite"
                  aria-label={`Satisfaction value: ${sliderValue}`}
                >
                  {sliderValue}%
                </span>
              </div>
              <input
                id="satisfaction"
                type="range"
                name="satisfaction"
                data-testid="input-range"
                aria-label="Satisfaction level"
                min={0}
                max={100}
                step={1}
                value={sliderValue}
                onChange={(e) => setSliderValue(Number(e.target.value))}
                className="w-full"
              />
              <div className="flex justify-between text-xs text-zinc-600 mt-1">
                <span>0%</span>
                <span>50%</span>
                <span>100%</span>
              </div>
            </div>

            <div className="flex items-center justify-between">
              <div>
                <div className="text-sm font-medium text-zinc-300">Email notifications</div>
                <div className="text-xs text-zinc-500">Receive updates via email</div>
              </div>
              <button
                type="button"
                role="switch"
                data-testid="toggle-notifications"
                aria-checked={toggleValue}
                aria-label="Toggle email notifications"
                onClick={() => setToggleValue((v) => !v)}
                className={`relative inline-flex w-11 h-6 rounded-full transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 focus:ring-offset-zinc-900 ${toggleValue ? "bg-indigo-600" : "bg-zinc-700"}`}
              >
                <span
                  className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform duration-200 ${toggleValue ? "translate-x-5" : "translate-x-0"}`}
                  aria-hidden="true"
                />
              </button>
            </div>
          </div>

          {/* File upload */}
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5 card-glow">
            <h2 className="text-sm font-semibold text-zinc-200 mb-4">File Upload</h2>

            <div
              data-testid="file-drop-zone"
              role="button"
              tabIndex={0}
              aria-label="File upload drop zone. Click or drag files here"
              onDragEnter={() => setIsDragging(true)}
              onDragLeave={() => setIsDragging(false)}
              onDragOver={(e) => {
                e.preventDefault();
                setIsDragging(true);
              }}
              onDrop={handleFileDrop}
              onClick={() => fileInputRef.current?.click()}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") fileInputRef.current?.click();
              }}
              className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-all duration-200 ${isDragging ? "border-indigo-500 bg-indigo-500/5" : "border-zinc-700 hover:border-zinc-600 hover:bg-zinc-800/30"}`}
            >
              <Upload size={24} className="text-zinc-500 mx-auto mb-2" aria-hidden="true" />
              <p className="text-sm text-zinc-400">
                Drop files here or <span className="text-indigo-400">browse</span>
              </p>
              <p className="text-xs text-zinc-600 mt-1">Any file type accepted</p>
            </div>

            <input
              ref={fileInputRef}
              type="file"
              multiple
              data-testid="file-input"
              aria-label="File input"
              onChange={handleFileInput}
              className="hidden"
            />

            {uploadedFiles.length > 0 && (
              <div
                className="mt-3 space-y-1"
                data-testid="uploaded-files"
                aria-label="Uploaded files"
              >
                {uploadedFiles.map((name, i) => (
                  <div
                    key={i}
                    className="flex items-center gap-2 text-xs text-zinc-400 bg-zinc-800 rounded-lg px-3 py-1.5"
                  >
                    <Check size={12} className="text-green-400" aria-hidden="true" />
                    {name}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Actions */}
        <div className="flex gap-3 pt-2">
          <button
            type="submit"
            data-testid="form-submit"
            disabled={submitting}
            aria-label="Submit form"
            aria-busy={submitting}
            className="flex items-center gap-2 px-6 py-2.5 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-medium rounded-lg transition-all duration-150"
          >
            {submitting && (
              <div
                className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"
                aria-hidden="true"
              />
            )}
            {submitting ? "Submitting…" : "Submit Form"}
          </button>
          <button
            type="button"
            data-testid="form-reset"
            onClick={handleReset}
            aria-label="Reset form"
            className="px-6 py-2.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-sm font-medium rounded-lg transition-all duration-150"
          >
            Reset
          </button>
        </div>

        {/* Result */}
        {submitResult && (
          <div
            data-testid="form-result"
            aria-live="polite"
            aria-label="Form submission result"
            className="bg-zinc-900 border border-green-800/50 rounded-xl p-4 card-glow"
          >
            <div className="flex items-center gap-2 text-green-400 text-sm font-medium mb-3">
              <Check size={14} aria-hidden="true" />
              Form submitted successfully — {submitResult.fieldCount} fields
            </div>
            <pre
              data-testid="form-result-json"
              className="text-xs text-zinc-400 bg-zinc-950 rounded-lg p-3 overflow-auto max-h-48 whitespace-pre-wrap font-mono"
            >
              {JSON.stringify(submitResult.submitted, null, 2)}
            </pre>
          </div>
        )}
      </form>
    </div>
  );
}
