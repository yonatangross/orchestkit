/**
 * Accessible Form Template
 *
 * Production-ready form component with WCAG 2.2 AA compliance:
 * - Associated labels with htmlFor
 * - Required field indicators
 * - Error messages with role="alert"
 * - aria-invalid and aria-describedby
 * - Focus indicators
 * - AutoComplete attributes
 * - Live region for status updates
 *
 * Usage:
 * 1. Copy this template
 * 2. Replace field definitions with your form fields
 * 3. Update validation schema
 * 4. Implement submission logic
 */

import { useState } from 'react';
import { z } from 'zod';

// ============================================================================
// SCHEMA DEFINITION
// ============================================================================

const FormSchema = z.object({
  // Text input
  fullName: z.string().min(1, 'Name is required'),

  // Email input
  email: z.string().email('Please enter a valid email address'),

  // Phone input with custom validation
  phone: z
    .string()
    .regex(/^\d{3}-\d{3}-\d{4}$/, 'Phone must be in format 123-456-7890')
    .optional(),

  // Select dropdown
  country: z.enum(['us', 'ca', 'uk', 'other'], {
    errorMap: () => ({ message: 'Please select a country' }),
  }),

  // Checkbox
  agreeToTerms: z.boolean().refine((val) => val === true, {
    message: 'You must agree to the terms and conditions',
  }),

  // Textarea
  comments: z.string().max(500, 'Comments must be 500 characters or less').optional(),
});

type FormData = z.infer<typeof FormSchema>;

// ============================================================================
// COMPONENT
// ============================================================================

export function AccessibleFormTemplate() {
  const [formData, setFormData] = useState<FormData>({
    fullName: '',
    email: '',
    phone: '',
    country: 'us',
    agreeToTerms: false,
    comments: '',
  });

  const [errors, setErrors] = useState<Partial<Record<keyof FormData, string>>>({});
  const [submitStatus, setSubmitStatus] = useState<{
    type: 'success' | 'error' | null;
    message: string;
  }>({ type: null, message: '' });
  const [isSubmitting, setIsSubmitting] = useState(false);

  // ==========================================================================
  // HANDLERS
  // ==========================================================================

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    setIsSubmitting(true);
    setSubmitStatus({ type: null, message: '' });

    // Validate form data
    const result = FormSchema.safeParse(formData);

    if (!result.success) {
      const fieldErrors: Partial<Record<keyof FormData, string>> = {};
      result.error.issues.forEach((issue) => {
        const field = issue.path[0] as keyof FormData;
        fieldErrors[field] = issue.message;
      });
      setErrors(fieldErrors);
      setSubmitStatus({
        type: 'error',
        message: `Please correct the ${Object.keys(fieldErrors).length} error${
          Object.keys(fieldErrors).length > 1 ? 's' : ''
        } below`,
      });
      setIsSubmitting(false);

      // Focus first field with error
      const firstErrorField = Object.keys(fieldErrors)[0];
      document.getElementById(firstErrorField)?.focus();
      return;
    }

    // Submit form
    try {
      // Replace with your API call
      await new Promise((resolve) => setTimeout(resolve, 1000));
      console.log('Form submitted:', result.data);

      setErrors({});
      setSubmitStatus({
        type: 'success',
        message: 'Form submitted successfully!',
      });

      // Reset form
      setFormData({
        fullName: '',
        email: '',
        phone: '',
        country: 'us',
        agreeToTerms: false,
        comments: '',
      });
    } catch (error) {
      setSubmitStatus({
        type: 'error',
        message: 'An error occurred. Please try again.',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const updateField = <K extends keyof FormData>(field: K, value: FormData[K]) => {
    setFormData({ ...formData, [field]: value });

    // Clear error when user starts typing
    if (errors[field]) {
      setErrors({ ...errors, [field]: undefined });
    }
  };

  // ==========================================================================
  // RENDER
  // ==========================================================================

  return (
    <form onSubmit={handleSubmit} noValidate className="max-w-2xl mx-auto p-6">
      <h1 className="text-3xl font-bold mb-6">Contact Form</h1>

      {/* Status Message - Announced by Screen Readers */}
      {submitStatus.message && (
        <div
          role={submitStatus.type === 'error' ? 'alert' : 'status'}
          aria-live="polite"
          aria-atomic="true"
          className={`mb-6 p-4 rounded-lg ${
            submitStatus.type === 'success'
              ? 'bg-green-50 text-green-900 border border-green-200'
              : 'bg-red-50 text-red-900 border border-red-200'
          }`}
        >
          {submitStatus.message}
        </div>
      )}

      {/* Full Name Field */}
      <div className="mb-6">
        <label htmlFor="fullName" className="block mb-2 font-medium text-gray-900">
          Full Name <span className="text-red-600" aria-label="required">*</span>
        </label>
        <input
          type="text"
          id="fullName"
          name="fullName"
          autoComplete="name"
          value={formData.fullName}
          onChange={(e) => updateField('fullName', e.target.value)}
          aria-required="true"
          aria-invalid={!!errors.fullName}
          aria-describedby={errors.fullName ? 'fullName-error' : undefined}
          className={`w-full px-4 py-2 border rounded-lg focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 ${
            errors.fullName ? 'border-red-600' : 'border-gray-300'
          }`}
        />
        {errors.fullName && (
          <p id="fullName-error" role="alert" className="text-red-600 text-sm mt-1">
            {errors.fullName}
          </p>
        )}
      </div>

      {/* Email Field */}
      <div className="mb-6">
        <label htmlFor="email" className="block mb-2 font-medium text-gray-900">
          Email Address <span className="text-red-600" aria-label="required">*</span>
        </label>
        <input
          type="email"
          id="email"
          name="email"
          autoComplete="email"
          value={formData.email}
          onChange={(e) => updateField('email', e.target.value)}
          aria-required="true"
          aria-invalid={!!errors.email}
          aria-describedby={errors.email ? 'email-error' : 'email-hint'}
          className={`w-full px-4 py-2 border rounded-lg focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 ${
            errors.email ? 'border-red-600' : 'border-gray-300'
          }`}
        />
        <p id="email-hint" className="text-sm text-gray-600 mt-1">
          We'll never share your email with anyone else
        </p>
        {errors.email && (
          <p id="email-error" role="alert" className="text-red-600 text-sm mt-1">
            {errors.email}
          </p>
        )}
      </div>

      {/* Phone Field (Optional) */}
      <div className="mb-6">
        <label htmlFor="phone" className="block mb-2 font-medium text-gray-900">
          Phone Number <span className="text-sm text-gray-600">(optional)</span>
        </label>
        <input
          type="tel"
          id="phone"
          name="phone"
          autoComplete="tel"
          placeholder="123-456-7890"
          value={formData.phone}
          onChange={(e) => updateField('phone', e.target.value)}
          aria-invalid={!!errors.phone}
          aria-describedby={errors.phone ? 'phone-error' : 'phone-hint'}
          className={`w-full px-4 py-2 border rounded-lg focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 ${
            errors.phone ? 'border-red-600' : 'border-gray-300'
          }`}
        />
        <p id="phone-hint" className="text-sm text-gray-600 mt-1">
          Format: 123-456-7890
        </p>
        {errors.phone && (
          <p id="phone-error" role="alert" className="text-red-600 text-sm mt-1">
            {errors.phone}
          </p>
        )}
      </div>

      {/* Country Select */}
      <div className="mb-6">
        <label htmlFor="country" className="block mb-2 font-medium text-gray-900">
          Country <span className="text-red-600" aria-label="required">*</span>
        </label>
        <select
          id="country"
          name="country"
          autoComplete="country"
          value={formData.country}
          onChange={(e) => updateField('country', e.target.value as FormData['country'])}
          aria-required="true"
          aria-invalid={!!errors.country}
          aria-describedby={errors.country ? 'country-error' : undefined}
          className={`w-full px-4 py-2 border rounded-lg focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 ${
            errors.country ? 'border-red-600' : 'border-gray-300'
          }`}
        >
          <option value="us">United States</option>
          <option value="ca">Canada</option>
          <option value="uk">United Kingdom</option>
          <option value="other">Other</option>
        </select>
        {errors.country && (
          <p id="country-error" role="alert" className="text-red-600 text-sm mt-1">
            {errors.country}
          </p>
        )}
      </div>

      {/* Comments Textarea */}
      <div className="mb-6">
        <label htmlFor="comments" className="block mb-2 font-medium text-gray-900">
          Additional Comments <span className="text-sm text-gray-600">(optional)</span>
        </label>
        <textarea
          id="comments"
          name="comments"
          rows={4}
          maxLength={500}
          value={formData.comments}
          onChange={(e) => updateField('comments', e.target.value)}
          aria-invalid={!!errors.comments}
          aria-describedby={errors.comments ? 'comments-error' : 'comments-hint'}
          className={`w-full px-4 py-2 border rounded-lg focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 ${
            errors.comments ? 'border-red-600' : 'border-gray-300'
          }`}
        />
        <p id="comments-hint" className="text-sm text-gray-600 mt-1">
          {formData.comments?.length || 0}/500 characters
        </p>
        {errors.comments && (
          <p id="comments-error" role="alert" className="text-red-600 text-sm mt-1">
            {errors.comments}
          </p>
        )}
      </div>

      {/* Terms Checkbox */}
      <div className="mb-6">
        <label className="flex items-start gap-3">
          <input
            type="checkbox"
            id="agreeToTerms"
            name="agreeToTerms"
            checked={formData.agreeToTerms}
            onChange={(e) => updateField('agreeToTerms', e.target.checked)}
            aria-required="true"
            aria-invalid={!!errors.agreeToTerms}
            aria-describedby={errors.agreeToTerms ? 'agreeToTerms-error' : undefined}
            className="mt-1 w-5 h-5 border-gray-300 rounded focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"
          />
          <span className="text-gray-900">
            I agree to the{' '}
            <a
              href="/terms"
              className="text-blue-600 underline hover:text-blue-800"
              target="_blank"
              rel="noopener noreferrer"
            >
              terms and conditions
            </a>
            <span className="text-red-600" aria-label="required"> *</span>
          </span>
        </label>
        {errors.agreeToTerms && (
          <p id="agreeToTerms-error" role="alert" className="text-red-600 text-sm mt-1">
            {errors.agreeToTerms}
          </p>
        )}
      </div>

      {/* Submit Button */}
      <button
        type="submit"
        disabled={isSubmitting}
        className="px-6 py-3 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {isSubmitting ? 'Submitting...' : 'Submit Form'}
      </button>
    </form>
  );
}

// ============================================================================
// HELPER COMPONENT: Skip Link (add to layout)
// ============================================================================

export function SkipLink() {
  return (
    <a
      href="#main-content"
      className="sr-only focus:not-sr-only focus:absolute focus:top-0 focus:left-0 focus:z-50 focus:px-4 focus:py-2 focus:bg-blue-600 focus:text-white"
    >
      Skip to main content
    </a>
  );
}

// ============================================================================
// STYLES: Add to globals.css
// ============================================================================

/**
 * Screen reader only class (visually hidden but accessible)
 */
/*
.sr-only {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
  border-width: 0;
}

.sr-only:focus,
.sr-only:active {
  position: static;
  width: auto;
  height: auto;
  overflow: visible;
  clip: auto;
  white-space: normal;
}
*/

// ============================================================================
// TESTING CHECKLIST
// ============================================================================

/**
 * Manual Testing:
 * [ ] Tab through form, verify focus indicators visible
 * [ ] Submit with errors, verify error messages announced
 * [ ] Submit successfully, verify success message announced
 * [ ] Test with NVDA/JAWS/VoiceOver screen reader
 * [ ] Verify all labels read correctly
 * [ ] Verify error messages linked to fields
 * [ ] Verify required fields announced as required
 * [ ] Verify invalid fields announced as invalid
 * [ ] Test at 400% zoom (no horizontal scroll)
 * [ ] Test with keyboard only (no mouse)
 *
 * Automated Testing:
 * [ ] Run axe DevTools browser extension
 * [ ] Run Lighthouse accessibility audit
 * [ ] Verify color contrast with WebAIM checker
 * [ ] Add Playwright accessibility test:
 *
 * test('should not have accessibility violations', async ({ page }) => {
 *   await page.goto('/contact');
 *   const accessibilityScanResults = await new AxeBuilder({ page }).analyze();
 *   expect(accessibilityScanResults.violations).toEqual([]);
 * });
 */
