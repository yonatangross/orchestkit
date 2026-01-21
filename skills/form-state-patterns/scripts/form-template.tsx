/**
 * Production Form Template with React Hook Form + Zod
 *
 * Features:
 * - Type-safe forms with Zod schema inference
 * - Field arrays with add/remove
 * - Controlled component integration
 * - Server-side validation (Server Actions)
 * - Full accessibility support
 * - Loading states and error handling
 * - Multi-step wizard pattern
 *
 * Usage:
 * 1. Copy this template
 * 2. Modify schema for your fields
 * 3. Update API endpoint
 * 4. Customize field components
 */
'use client';

import { useState, useEffect } from 'react';
import {
  useForm,
  useFieldArray,
  Controller,
  FormProvider,
  useFormContext,
  type SubmitHandler,
  type FieldErrors,
} from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';

// ============================================
// Schema Definition
// ============================================

const addressSchema = z.object({
  street: z.string().min(5, 'Street address is required'),
  city: z.string().min(2, 'City is required'),
  state: z.string().min(2, 'State is required'),
  postalCode: z.string().regex(/^\d{5}(-\d{4})?$/, 'Invalid postal code'),
  country: z.string().min(2, 'Country is required'),
});

const contactSchema = z.object({
  type: z.enum(['home', 'work', 'mobile']),
  value: z.string().min(1, 'Contact value is required'),
});

const formSchema = z.object({
  // Basic fields
  firstName: z.string()
    .min(2, 'First name must be at least 2 characters')
    .max(50, 'First name must be less than 50 characters'),
  lastName: z.string()
    .min(2, 'Last name must be at least 2 characters')
    .max(50, 'Last name must be less than 50 characters'),
  email: z.string()
    .min(1, 'Email is required')
    .email('Please enter a valid email'),
  phone: z.string()
    .regex(/^\+?[1-9]\d{1,14}$/, 'Please enter a valid phone number')
    .optional()
    .or(z.literal('')),

  // Nested object
  address: addressSchema,

  // Field array
  contacts: z.array(contactSchema)
    .min(1, 'At least one contact is required')
    .max(5, 'Maximum 5 contacts allowed'),

  // Optional fields
  bio: z.string().max(500, 'Bio must be less than 500 characters').optional(),
  birthDate: z.coerce.date().max(new Date(), 'Cannot be in the future').optional(),

  // Boolean
  newsletter: z.boolean().default(false),
  terms: z.boolean().refine((val) => val === true, 'You must accept the terms'),
});

type FormData = z.infer<typeof formSchema>;

// ============================================
// Field Components
// ============================================

interface FormFieldProps {
  name: keyof FormData | `address.${keyof FormData['address']}`;
  label: string;
  type?: 'text' | 'email' | 'tel' | 'date' | 'textarea';
  placeholder?: string;
  required?: boolean;
}

function FormField({ name, label, type = 'text', placeholder, required }: FormFieldProps) {
  const {
    register,
    formState: { errors },
  } = useFormContext<FormData>();

  // Navigate to nested error
  const error = name.includes('.')
    ? (errors as any)[name.split('.')[0]]?.[name.split('.')[1]]
    : (errors as any)[name];

  const inputId = `field-${name}`;
  const errorId = `${inputId}-error`;

  const commonProps = {
    id: inputId,
    placeholder,
    'aria-invalid': !!error,
    'aria-describedby': error ? errorId : undefined,
    'aria-required': required,
    className: `mt-1 block w-full rounded-md border px-3 py-2 ${
      error ? 'border-red-500' : 'border-gray-300'
    }`,
  };

  return (
    <div>
      <label htmlFor={inputId} className="block text-sm font-medium text-gray-700">
        {label}
        {required && <span className="text-red-500 ml-1">*</span>}
      </label>

      {type === 'textarea' ? (
        <textarea rows={4} {...register(name as any)} {...commonProps} />
      ) : (
        <input type={type} {...register(name as any)} {...commonProps} />
      )}

      {error && (
        <p id={errorId} role="alert" className="mt-1 text-sm text-red-600">
          {error.message as string}
        </p>
      )}
    </div>
  );
}

// ============================================
// Contact Field Array
// ============================================

function ContactsFieldArray() {
  const {
    control,
    register,
    formState: { errors },
  } = useFormContext<FormData>();

  const { fields, append, remove } = useFieldArray({
    control,
    name: 'contacts',
  });

  const contactsError = errors.contacts?.message || errors.contacts?.root?.message;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-medium">Contact Methods</h3>
        <button
          type="button"
          onClick={() => append({ type: 'mobile', value: '' })}
          disabled={fields.length >= 5}
          className="text-sm text-blue-600 hover:text-blue-800 disabled:text-gray-400"
        >
          + Add Contact
        </button>
      </div>

      {contactsError && (
        <p role="alert" className="text-sm text-red-600">
          {contactsError}
        </p>
      )}

      {fields.map((field, index) => (
        <div key={field.id} className="flex gap-4 items-start">
          <div className="w-32">
            <select
              {...register(`contacts.${index}.type`)}
              className="block w-full rounded-md border border-gray-300 px-3 py-2"
            >
              <option value="mobile">Mobile</option>
              <option value="home">Home</option>
              <option value="work">Work</option>
            </select>
          </div>

          <div className="flex-1">
            <input
              {...register(`contacts.${index}.value`)}
              placeholder="Contact value"
              aria-invalid={!!errors.contacts?.[index]?.value}
              className={`block w-full rounded-md border px-3 py-2 ${
                errors.contacts?.[index]?.value ? 'border-red-500' : 'border-gray-300'
              }`}
            />
            {errors.contacts?.[index]?.value && (
              <p role="alert" className="mt-1 text-sm text-red-600">
                {errors.contacts[index]?.value?.message}
              </p>
            )}
          </div>

          <button
            type="button"
            onClick={() => remove(index)}
            disabled={fields.length <= 1}
            className="text-red-500 hover:text-red-700 disabled:text-gray-400 p-2"
            aria-label={`Remove contact ${index + 1}`}
          >
            ×
          </button>
        </div>
      ))}
    </div>
  );
}

// ============================================
// Controlled Component Example
// ============================================

interface DatePickerProps {
  value: Date | undefined;
  onChange: (date: Date | undefined) => void;
  onBlur: () => void;
  error?: string;
}

function DatePickerField({ value, onChange, onBlur, error }: DatePickerProps) {
  // This would be your actual date picker component
  return (
    <div>
      <input
        type="date"
        value={value ? value.toISOString().split('T')[0] : ''}
        onChange={(e) => onChange(e.target.value ? new Date(e.target.value) : undefined)}
        onBlur={onBlur}
        aria-invalid={!!error}
        className={`block w-full rounded-md border px-3 py-2 ${
          error ? 'border-red-500' : 'border-gray-300'
        }`}
      />
      {error && (
        <p role="alert" className="mt-1 text-sm text-red-600">
          {error}
        </p>
      )}
    </div>
  );
}

// ============================================
// Main Form Component
// ============================================

interface ProfileFormProps {
  defaultValues?: Partial<FormData>;
  onSubmitSuccess?: (data: FormData) => void;
}

export function ProfileForm({ defaultValues, onSubmitSuccess }: ProfileFormProps) {
  const [serverError, setServerError] = useState<string | null>(null);

  const methods = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      firstName: '',
      lastName: '',
      email: '',
      phone: '',
      address: {
        street: '',
        city: '',
        state: '',
        postalCode: '',
        country: 'US',
      },
      contacts: [{ type: 'mobile', value: '' }],
      bio: '',
      newsletter: false,
      terms: false,
      ...defaultValues,
    },
    mode: 'onBlur', // Validate on blur for better UX
  });

  const {
    handleSubmit,
    control,
    reset,
    setError,
    formState: { errors, isSubmitting, isSubmitSuccessful, isDirty },
  } = methods;

  const onSubmit: SubmitHandler<FormData> = async (data) => {
    setServerError(null);

    try {
      const response = await fetch('/api/profile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        const error = await response.json();

        // Handle field-specific server errors
        if (error.fieldErrors) {
          Object.entries(error.fieldErrors).forEach(([field, message]) => {
            setError(field as keyof FormData, {
              type: 'server',
              message: message as string,
            });
          });
          return;
        }

        throw new Error(error.message || 'Failed to save profile');
      }

      const result = await response.json();
      onSubmitSuccess?.(result);
    } catch (error) {
      setServerError(error instanceof Error ? error.message : 'An error occurred');
      throw error; // Re-throw to keep isSubmitting accurate
    }
  };

  // Success message
  if (isSubmitSuccessful) {
    return (
      <div role="status" className="p-6 bg-green-50 rounded-lg text-center">
        <h2 className="text-xl font-semibold text-green-800">Profile Saved!</h2>
        <p className="text-green-600 mt-2">Your changes have been saved successfully.</p>
        <button
          type="button"
          onClick={() => reset()}
          className="mt-4 text-green-700 underline"
        >
          Make more changes
        </button>
      </div>
    );
  }

  return (
    <FormProvider {...methods}>
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6" noValidate>
        {/* Server Error */}
        {serverError && (
          <div role="alert" className="p-4 bg-red-50 border border-red-200 rounded-lg">
            <p className="text-red-700">{serverError}</p>
          </div>
        )}

        {/* Personal Information */}
        <fieldset className="border border-gray-200 rounded-lg p-4">
          <legend className="text-lg font-medium px-2">Personal Information</legend>

          <div className="grid grid-cols-2 gap-4 mt-4">
            <FormField name="firstName" label="First Name" required />
            <FormField name="lastName" label="Last Name" required />
          </div>

          <div className="grid grid-cols-2 gap-4 mt-4">
            <FormField name="email" label="Email" type="email" required />
            <FormField name="phone" label="Phone" type="tel" placeholder="+1234567890" />
          </div>

          <div className="mt-4">
            <label className="block text-sm font-medium text-gray-700">Birth Date</label>
            <Controller
              name="birthDate"
              control={control}
              render={({ field, fieldState }) => (
                <DatePickerField
                  value={field.value}
                  onChange={field.onChange}
                  onBlur={field.onBlur}
                  error={fieldState.error?.message}
                />
              )}
            />
          </div>
        </fieldset>

        {/* Address */}
        <fieldset className="border border-gray-200 rounded-lg p-4">
          <legend className="text-lg font-medium px-2">Address</legend>

          <div className="space-y-4 mt-4">
            <FormField name="address.street" label="Street Address" required />

            <div className="grid grid-cols-2 gap-4">
              <FormField name="address.city" label="City" required />
              <FormField name="address.state" label="State" required />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <FormField name="address.postalCode" label="Postal Code" required />
              <FormField name="address.country" label="Country" required />
            </div>
          </div>
        </fieldset>

        {/* Contact Methods */}
        <fieldset className="border border-gray-200 rounded-lg p-4">
          <legend className="text-lg font-medium px-2">Contact Methods</legend>
          <div className="mt-4">
            <ContactsFieldArray />
          </div>
        </fieldset>

        {/* Bio */}
        <div>
          <FormField name="bio" label="Bio" type="textarea" />
        </div>

        {/* Checkboxes */}
        <div className="space-y-4">
          <label className="flex items-center gap-3">
            <input
              type="checkbox"
              {...methods.register('newsletter')}
              className="rounded border-gray-300"
            />
            <span className="text-sm text-gray-700">Subscribe to newsletter</span>
          </label>

          <div>
            <label className="flex items-center gap-3">
              <input
                type="checkbox"
                {...methods.register('terms')}
                aria-invalid={!!errors.terms}
                className="rounded border-gray-300"
              />
              <span className="text-sm text-gray-700">
                I accept the <a href="/terms" className="text-blue-600 underline">terms and conditions</a>
                <span className="text-red-500 ml-1">*</span>
              </span>
            </label>
            {errors.terms && (
              <p role="alert" className="mt-1 text-sm text-red-600">
                {errors.terms.message}
              </p>
            )}
          </div>
        </div>

        {/* Submit Button */}
        <div className="flex gap-4">
          <button
            type="submit"
            disabled={isSubmitting}
            className="flex-1 rounded-md bg-blue-600 px-4 py-3 text-white font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isSubmitting ? (
              <span className="flex items-center justify-center gap-2">
                <span className="animate-spin">⏳</span>
                Saving...
              </span>
            ) : (
              'Save Profile'
            )}
          </button>

          <button
            type="button"
            onClick={() => reset()}
            disabled={!isDirty || isSubmitting}
            className="px-4 py-3 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50 disabled:opacity-50"
          >
            Reset
          </button>
        </div>
      </form>
    </FormProvider>
  );
}

// ============================================
// Multi-Step Wizard Example
// ============================================

const wizardSteps = ['account', 'profile', 'preferences'] as const;
type WizardStep = (typeof wizardSteps)[number];

const wizardSchema = z.object({
  account: z.object({
    email: z.string().email('Please enter a valid email'),
    password: z.string()
      .min(8, 'Password must be at least 8 characters')
      .regex(/[A-Z]/, 'Must contain uppercase')
      .regex(/[0-9]/, 'Must contain number'),
    confirmPassword: z.string(),
  }).refine((data) => data.password === data.confirmPassword, {
    message: "Passwords don't match",
    path: ['confirmPassword'],
  }),
  profile: z.object({
    name: z.string().min(2, 'Name is required'),
    avatar: z.string().url().optional(),
  }),
  preferences: z.object({
    newsletter: z.boolean(),
    notifications: z.enum(['all', 'important', 'none']),
  }),
});

type WizardData = z.infer<typeof wizardSchema>;

export function WizardForm() {
  const [currentStep, setCurrentStep] = useState(0);
  const step = wizardSteps[currentStep];

  const methods = useForm<WizardData>({
    resolver: zodResolver(wizardSchema),
    mode: 'onTouched',
    defaultValues: {
      account: { email: '', password: '', confirmPassword: '' },
      profile: { name: '', avatar: '' },
      preferences: { newsletter: true, notifications: 'important' },
    },
  });

  const {
    handleSubmit,
    trigger,
    formState: { isSubmitting },
  } = methods;

  const nextStep = async () => {
    const isValid = await trigger(step);
    if (isValid) {
      setCurrentStep((s) => Math.min(s + 1, wizardSteps.length - 1));
    }
  };

  const prevStep = () => {
    setCurrentStep((s) => Math.max(s - 1, 0));
  };

  const onSubmit: SubmitHandler<WizardData> = async (data) => {
    await fetch('/api/signup', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
  };

  return (
    <FormProvider {...methods}>
      <form onSubmit={handleSubmit(onSubmit)} className="max-w-md mx-auto">
        {/* Progress Indicator */}
        <div className="flex justify-between mb-8">
          {wizardSteps.map((s, index) => (
            <div
              key={s}
              className={`flex items-center ${
                index < currentStep
                  ? 'text-green-600'
                  : index === currentStep
                    ? 'text-blue-600'
                    : 'text-gray-400'
              }`}
            >
              <div
                className={`w-8 h-8 rounded-full flex items-center justify-center border-2 ${
                  index <= currentStep ? 'border-current bg-current/10' : 'border-gray-300'
                }`}
              >
                {index < currentStep ? '✓' : index + 1}
              </div>
              <span className="ml-2 text-sm capitalize">{s}</span>
            </div>
          ))}
        </div>

        {/* Step Content */}
        <div className="min-h-[300px]">
          {step === 'account' && <AccountStep />}
          {step === 'profile' && <ProfileStep />}
          {step === 'preferences' && <PreferencesStep />}
        </div>

        {/* Navigation */}
        <div className="flex justify-between mt-8">
          <button
            type="button"
            onClick={prevStep}
            disabled={currentStep === 0}
            className="px-4 py-2 border rounded disabled:opacity-50"
          >
            Back
          </button>

          {currentStep < wizardSteps.length - 1 ? (
            <button
              type="button"
              onClick={nextStep}
              className="px-4 py-2 bg-blue-600 text-white rounded"
            >
              Next
            </button>
          ) : (
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-4 py-2 bg-green-600 text-white rounded disabled:opacity-50"
            >
              {isSubmitting ? 'Creating...' : 'Create Account'}
            </button>
          )}
        </div>
      </form>
    </FormProvider>
  );
}

// Step Components
function AccountStep() {
  const { register, formState: { errors } } = useFormContext<WizardData>();

  return (
    <div className="space-y-4">
      <h2 className="text-xl font-semibold">Create Account</h2>
      <div>
        <input
          {...register('account.email')}
          type="email"
          placeholder="Email"
          className="w-full p-3 border rounded"
        />
        {errors.account?.email && (
          <p className="text-red-500 text-sm mt-1">{errors.account.email.message}</p>
        )}
      </div>
      <div>
        <input
          {...register('account.password')}
          type="password"
          placeholder="Password"
          className="w-full p-3 border rounded"
        />
        {errors.account?.password && (
          <p className="text-red-500 text-sm mt-1">{errors.account.password.message}</p>
        )}
      </div>
      <div>
        <input
          {...register('account.confirmPassword')}
          type="password"
          placeholder="Confirm Password"
          className="w-full p-3 border rounded"
        />
        {errors.account?.confirmPassword && (
          <p className="text-red-500 text-sm mt-1">{errors.account.confirmPassword.message}</p>
        )}
      </div>
    </div>
  );
}

function ProfileStep() {
  const { register, formState: { errors } } = useFormContext<WizardData>();

  return (
    <div className="space-y-4">
      <h2 className="text-xl font-semibold">Your Profile</h2>
      <div>
        <input
          {...register('profile.name')}
          placeholder="Your Name"
          className="w-full p-3 border rounded"
        />
        {errors.profile?.name && (
          <p className="text-red-500 text-sm mt-1">{errors.profile.name.message}</p>
        )}
      </div>
      <div>
        <input
          {...register('profile.avatar')}
          placeholder="Avatar URL (optional)"
          className="w-full p-3 border rounded"
        />
      </div>
    </div>
  );
}

function PreferencesStep() {
  const { register } = useFormContext<WizardData>();

  return (
    <div className="space-y-4">
      <h2 className="text-xl font-semibold">Preferences</h2>
      <label className="flex items-center gap-3">
        <input type="checkbox" {...register('preferences.newsletter')} />
        <span>Subscribe to newsletter</span>
      </label>
      <div>
        <label className="block mb-2">Notifications</label>
        <select {...register('preferences.notifications')} className="w-full p-3 border rounded">
          <option value="all">All notifications</option>
          <option value="important">Important only</option>
          <option value="none">None</option>
        </select>
      </div>
    </div>
  );
}
