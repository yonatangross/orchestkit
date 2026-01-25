# Form State Examples

Real-world form implementations with React Hook Form v7 + Zod.

---

## 1. User Registration with Password Strength

Complete registration form with password strength indicator and confirmation.

```typescript
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useState, useCallback } from 'react';

// Password strength calculator
function getPasswordStrength(password: string): {
  score: number;
  label: string;
  color: string;
} {
  let score = 0;
  if (password.length >= 8) score++;
  if (password.length >= 12) score++;
  if (/[a-z]/.test(password) && /[A-Z]/.test(password)) score++;
  if (/\d/.test(password)) score++;
  if (/[^a-zA-Z0-9]/.test(password)) score++;

  const levels = [
    { label: 'Very Weak', color: 'bg-red-500' },
    { label: 'Weak', color: 'bg-orange-500' },
    { label: 'Fair', color: 'bg-yellow-500' },
    { label: 'Strong', color: 'bg-lime-500' },
    { label: 'Very Strong', color: 'bg-green-500' },
  ];

  return { score, ...levels[Math.min(score, 4)] };
}

// Schema with cross-field validation
const registrationSchema = z
  .object({
    email: z
      .string()
      .min(1, 'Email is required')
      .email('Please enter a valid email address'),
    username: z
      .string()
      .min(3, 'Username must be at least 3 characters')
      .max(20, 'Username must be at most 20 characters')
      .regex(/^[a-zA-Z0-9_]+$/, 'Only letters, numbers, and underscores'),
    password: z
      .string()
      .min(8, 'Password must be at least 8 characters')
      .regex(/[A-Z]/, 'Password must contain an uppercase letter')
      .regex(/[a-z]/, 'Password must contain a lowercase letter')
      .regex(/[0-9]/, 'Password must contain a number'),
    confirmPassword: z.string().min(1, 'Please confirm your password'),
    acceptTerms: z.literal(true, {
      errorMap: () => ({ message: 'You must accept the terms' }),
    }),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords don't match",
    path: ['confirmPassword'],
  });

type RegistrationForm = z.infer<typeof registrationSchema>;

export function RegistrationForm() {
  const [showPassword, setShowPassword] = useState(false);
  const {
    register,
    handleSubmit,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<RegistrationForm>({
    resolver: zodResolver(registrationSchema),
    defaultValues: {
      email: '',
      username: '',
      password: '',
      confirmPassword: '',
      acceptTerms: false as unknown as true, // Type workaround for z.literal(true)
    },
    mode: 'onBlur',
  });

  const password = watch('password');
  const strength = password ? getPasswordStrength(password) : null;

  const onSubmit = async (data: RegistrationForm) => {
    await api.register(data);
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-4">
      {/* Email */}
      <div>
        <label htmlFor="email" className="block text-sm font-medium">
          Email
        </label>
        <input
          id="email"
          type="email"
          {...register('email')}
          aria-invalid={!!errors.email}
          aria-describedby={errors.email ? 'email-error' : undefined}
          className="mt-1 block w-full rounded-md border px-3 py-2"
        />
        {errors.email && (
          <p id="email-error" role="alert" className="mt-1 text-sm text-red-600">
            {errors.email.message}
          </p>
        )}
      </div>

      {/* Username */}
      <div>
        <label htmlFor="username" className="block text-sm font-medium">
          Username
        </label>
        <input
          id="username"
          {...register('username')}
          aria-invalid={!!errors.username}
          aria-describedby={errors.username ? 'username-error' : undefined}
          className="mt-1 block w-full rounded-md border px-3 py-2"
        />
        {errors.username && (
          <p id="username-error" role="alert" className="mt-1 text-sm text-red-600">
            {errors.username.message}
          </p>
        )}
      </div>

      {/* Password with strength indicator */}
      <div>
        <label htmlFor="password" className="block text-sm font-medium">
          Password
        </label>
        <div className="relative">
          <input
            id="password"
            type={showPassword ? 'text' : 'password'}
            {...register('password')}
            aria-invalid={!!errors.password}
            aria-describedby={errors.password ? 'password-error' : 'password-strength'}
            className="mt-1 block w-full rounded-md border px-3 py-2 pr-10"
          />
          <button
            type="button"
            onClick={() => setShowPassword(!showPassword)}
            className="absolute right-3 top-1/2 -translate-y-1/2"
            aria-label={showPassword ? 'Hide password' : 'Show password'}
          >
            {showPassword ? '👁️' : '👁️‍🗨️'}
          </button>
        </div>
        {strength && (
          <div id="password-strength" className="mt-2">
            <div className="flex gap-1">
              {[...Array(5)].map((_, i) => (
                <div
                  key={i}
                  className={`h-1 flex-1 rounded ${
                    i < strength.score ? strength.color : 'bg-gray-200'
                  }`}
                />
              ))}
            </div>
            <p className="mt-1 text-sm text-gray-600">{strength.label}</p>
          </div>
        )}
        {errors.password && (
          <p id="password-error" role="alert" className="mt-1 text-sm text-red-600">
            {errors.password.message}
          </p>
        )}
      </div>

      {/* Confirm Password */}
      <div>
        <label htmlFor="confirmPassword" className="block text-sm font-medium">
          Confirm Password
        </label>
        <input
          id="confirmPassword"
          type="password"
          {...register('confirmPassword')}
          aria-invalid={!!errors.confirmPassword}
          aria-describedby={errors.confirmPassword ? 'confirm-error' : undefined}
          className="mt-1 block w-full rounded-md border px-3 py-2"
        />
        {errors.confirmPassword && (
          <p id="confirm-error" role="alert" className="mt-1 text-sm text-red-600">
            {errors.confirmPassword.message}
          </p>
        )}
      </div>

      {/* Terms */}
      <div className="flex items-start">
        <input
          id="acceptTerms"
          type="checkbox"
          {...register('acceptTerms')}
          aria-invalid={!!errors.acceptTerms}
          className="mt-1 h-4 w-4"
        />
        <label htmlFor="acceptTerms" className="ml-2 text-sm">
          I accept the <a href="/terms" className="underline">terms and conditions</a>
        </label>
      </div>
      {errors.acceptTerms && (
        <p role="alert" className="text-sm text-red-600">
          {errors.acceptTerms.message}
        </p>
      )}

      <button
        type="submit"
        disabled={isSubmitting}
        className="w-full rounded-md bg-blue-600 px-4 py-2 text-white disabled:opacity-50"
      >
        {isSubmitting ? 'Creating account...' : 'Create Account'}
      </button>
    </form>
  );
}
```

---

## 2. Multi-Step Checkout Wizard

E-commerce checkout with shipping, payment, and review steps.

```typescript
import { useForm, FormProvider, useFormContext } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useState } from 'react';

// Step schemas
const shippingSchema = z.object({
  firstName: z.string().min(1, 'First name is required'),
  lastName: z.string().min(1, 'Last name is required'),
  address: z.string().min(5, 'Address must be at least 5 characters'),
  city: z.string().min(2, 'City is required'),
  state: z.string().min(2, 'State is required'),
  zipCode: z.string().regex(/^\d{5}(-\d{4})?$/, 'Invalid ZIP code'),
  phone: z.string().regex(/^\+?[\d\s-()]+$/, 'Invalid phone number'),
});

const paymentSchema = z.object({
  cardNumber: z
    .string()
    .regex(/^\d{16}$/, 'Card number must be 16 digits'),
  cardName: z.string().min(1, 'Name on card is required'),
  expiryDate: z
    .string()
    .regex(/^(0[1-9]|1[0-2])\/\d{2}$/, 'Format: MM/YY'),
  cvv: z.string().regex(/^\d{3,4}$/, 'CVV must be 3-4 digits'),
});

// Combined schema
const checkoutSchema = z.object({
  shipping: shippingSchema,
  payment: paymentSchema,
  savePaymentMethod: z.boolean().optional(),
  notes: z.string().optional(),
});

type CheckoutForm = z.infer<typeof checkoutSchema>;

const steps = ['shipping', 'payment', 'review'] as const;
type Step = (typeof steps)[number];

// Step fields for validation
const stepFields: Record<Step, (keyof CheckoutForm)[]> = {
  shipping: ['shipping'],
  payment: ['payment'],
  review: [],
};

// Shipping Step Component
function ShippingStep() {
  const {
    register,
    formState: { errors },
  } = useFormContext<CheckoutForm>();

  return (
    <div className="space-y-4">
      <h2 className="text-xl font-semibold">Shipping Information</h2>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label htmlFor="firstName" className="block text-sm font-medium">
            First Name
          </label>
          <input
            id="firstName"
            {...register('shipping.firstName')}
            aria-invalid={!!errors.shipping?.firstName}
            className="mt-1 block w-full rounded-md border px-3 py-2"
          />
          {errors.shipping?.firstName && (
            <p role="alert" className="mt-1 text-sm text-red-600">
              {errors.shipping.firstName.message}
            </p>
          )}
        </div>

        <div>
          <label htmlFor="lastName" className="block text-sm font-medium">
            Last Name
          </label>
          <input
            id="lastName"
            {...register('shipping.lastName')}
            aria-invalid={!!errors.shipping?.lastName}
            className="mt-1 block w-full rounded-md border px-3 py-2"
          />
          {errors.shipping?.lastName && (
            <p role="alert" className="mt-1 text-sm text-red-600">
              {errors.shipping.lastName.message}
            </p>
          )}
        </div>
      </div>

      <div>
        <label htmlFor="address" className="block text-sm font-medium">
          Address
        </label>
        <input
          id="address"
          {...register('shipping.address')}
          aria-invalid={!!errors.shipping?.address}
          className="mt-1 block w-full rounded-md border px-3 py-2"
        />
        {errors.shipping?.address && (
          <p role="alert" className="mt-1 text-sm text-red-600">
            {errors.shipping.address.message}
          </p>
        )}
      </div>

      <div className="grid grid-cols-3 gap-4">
        <div>
          <label htmlFor="city" className="block text-sm font-medium">
            City
          </label>
          <input
            id="city"
            {...register('shipping.city')}
            className="mt-1 block w-full rounded-md border px-3 py-2"
          />
        </div>
        <div>
          <label htmlFor="state" className="block text-sm font-medium">
            State
          </label>
          <input
            id="state"
            {...register('shipping.state')}
            className="mt-1 block w-full rounded-md border px-3 py-2"
          />
        </div>
        <div>
          <label htmlFor="zipCode" className="block text-sm font-medium">
            ZIP Code
          </label>
          <input
            id="zipCode"
            {...register('shipping.zipCode')}
            className="mt-1 block w-full rounded-md border px-3 py-2"
          />
        </div>
      </div>

      <div>
        <label htmlFor="phone" className="block text-sm font-medium">
          Phone Number
        </label>
        <input
          id="phone"
          type="tel"
          {...register('shipping.phone')}
          className="mt-1 block w-full rounded-md border px-3 py-2"
        />
      </div>
    </div>
  );
}

// Payment Step Component
function PaymentStep() {
  const {
    register,
    formState: { errors },
  } = useFormContext<CheckoutForm>();

  return (
    <div className="space-y-4">
      <h2 className="text-xl font-semibold">Payment Information</h2>

      <div>
        <label htmlFor="cardNumber" className="block text-sm font-medium">
          Card Number
        </label>
        <input
          id="cardNumber"
          {...register('payment.cardNumber')}
          placeholder="1234 5678 9012 3456"
          maxLength={16}
          className="mt-1 block w-full rounded-md border px-3 py-2"
        />
        {errors.payment?.cardNumber && (
          <p role="alert" className="mt-1 text-sm text-red-600">
            {errors.payment.cardNumber.message}
          </p>
        )}
      </div>

      <div>
        <label htmlFor="cardName" className="block text-sm font-medium">
          Name on Card
        </label>
        <input
          id="cardName"
          {...register('payment.cardName')}
          className="mt-1 block w-full rounded-md border px-3 py-2"
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label htmlFor="expiryDate" className="block text-sm font-medium">
            Expiry Date
          </label>
          <input
            id="expiryDate"
            {...register('payment.expiryDate')}
            placeholder="MM/YY"
            maxLength={5}
            className="mt-1 block w-full rounded-md border px-3 py-2"
          />
        </div>
        <div>
          <label htmlFor="cvv" className="block text-sm font-medium">
            CVV
          </label>
          <input
            id="cvv"
            type="password"
            {...register('payment.cvv')}
            maxLength={4}
            className="mt-1 block w-full rounded-md border px-3 py-2"
          />
        </div>
      </div>

      <div className="flex items-center">
        <input
          id="savePayment"
          type="checkbox"
          {...register('savePaymentMethod')}
          className="h-4 w-4"
        />
        <label htmlFor="savePayment" className="ml-2 text-sm">
          Save payment method for future purchases
        </label>
      </div>
    </div>
  );
}

// Review Step Component
function ReviewStep() {
  const { watch } = useFormContext<CheckoutForm>();
  const data = watch();

  return (
    <div className="space-y-6">
      <h2 className="text-xl font-semibold">Review Order</h2>

      <div className="rounded-lg border p-4">
        <h3 className="font-medium">Shipping Address</h3>
        <p className="mt-2 text-gray-600">
          {data.shipping.firstName} {data.shipping.lastName}
          <br />
          {data.shipping.address}
          <br />
          {data.shipping.city}, {data.shipping.state} {data.shipping.zipCode}
          <br />
          {data.shipping.phone}
        </p>
      </div>

      <div className="rounded-lg border p-4">
        <h3 className="font-medium">Payment Method</h3>
        <p className="mt-2 text-gray-600">
          Card ending in {data.payment.cardNumber.slice(-4)}
          <br />
          Expires {data.payment.expiryDate}
        </p>
      </div>

      <div>
        <label htmlFor="notes" className="block text-sm font-medium">
          Order Notes (optional)
        </label>
        <textarea
          id="notes"
          {...useFormContext<CheckoutForm>().register('notes')}
          rows={3}
          className="mt-1 block w-full rounded-md border px-3 py-2"
        />
      </div>
    </div>
  );
}

// Step Indicator Component
function StepIndicator({
  current,
  steps,
}: {
  current: number;
  steps: readonly string[];
}) {
  return (
    <div className="flex items-center justify-between">
      {steps.map((step, index) => (
        <div key={step} className="flex items-center">
          <div
            className={`flex h-8 w-8 items-center justify-center rounded-full ${
              index <= current
                ? 'bg-blue-600 text-white'
                : 'bg-gray-200 text-gray-600'
            }`}
          >
            {index < current ? '✓' : index + 1}
          </div>
          <span className="ml-2 capitalize">{step}</span>
          {index < steps.length - 1 && (
            <div className="mx-4 h-0.5 w-16 bg-gray-200" />
          )}
        </div>
      ))}
    </div>
  );
}

// Main Checkout Form
export function CheckoutWizard() {
  const [currentStep, setCurrentStep] = useState(0);

  const methods = useForm<CheckoutForm>({
    resolver: zodResolver(checkoutSchema),
    defaultValues: {
      shipping: {
        firstName: '',
        lastName: '',
        address: '',
        city: '',
        state: '',
        zipCode: '',
        phone: '',
      },
      payment: {
        cardNumber: '',
        cardName: '',
        expiryDate: '',
        cvv: '',
      },
      savePaymentMethod: false,
      notes: '',
    },
    mode: 'onBlur',
  });

  const nextStep = async () => {
    const fields = stepFields[steps[currentStep]];
    const isValid = await methods.trigger(fields as any);
    if (isValid) {
      setCurrentStep((s) => Math.min(s + 1, steps.length - 1));
    }
  };

  const prevStep = () => {
    setCurrentStep((s) => Math.max(s - 1, 0));
  };

  const onSubmit = async (data: CheckoutForm) => {
    await api.placeOrder(data);
  };

  return (
    <FormProvider {...methods}>
      <div className="mx-auto max-w-2xl p-6">
        <StepIndicator current={currentStep} steps={steps} />

        <form onSubmit={methods.handleSubmit(onSubmit)} className="mt-8">
          {currentStep === 0 && <ShippingStep />}
          {currentStep === 1 && <PaymentStep />}
          {currentStep === 2 && <ReviewStep />}

          <div className="mt-8 flex justify-between">
            {currentStep > 0 && (
              <button
                type="button"
                onClick={prevStep}
                className="rounded-md border px-6 py-2"
              >
                Back
              </button>
            )}
            <div className="ml-auto">
              {currentStep < steps.length - 1 ? (
                <button
                  type="button"
                  onClick={nextStep}
                  className="rounded-md bg-blue-600 px-6 py-2 text-white"
                >
                  Continue
                </button>
              ) : (
                <button
                  type="submit"
                  disabled={methods.formState.isSubmitting}
                  className="rounded-md bg-green-600 px-6 py-2 text-white disabled:opacity-50"
                >
                  {methods.formState.isSubmitting
                    ? 'Processing...'
                    : 'Place Order'}
                </button>
              )}
            </div>
          </div>
        </form>
      </div>
    </FormProvider>
  );
}
```

---

## 3. Dynamic Invoice Builder

Invoice form with dynamic line items and automatic calculations.

```typescript
import { useForm, useFieldArray, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useMemo } from 'react';

const lineItemSchema = z.object({
  description: z.string().min(1, 'Description is required'),
  quantity: z.number().min(1, 'Quantity must be at least 1'),
  unitPrice: z.number().min(0, 'Price must be positive'),
  taxRate: z.number().min(0).max(100).optional(),
});

const invoiceSchema = z.object({
  invoiceNumber: z.string().min(1, 'Invoice number is required'),
  client: z.object({
    name: z.string().min(1, 'Client name is required'),
    email: z.string().email('Invalid email'),
    address: z.string().optional(),
  }),
  issueDate: z.string().min(1, 'Issue date is required'),
  dueDate: z.string().min(1, 'Due date is required'),
  items: z.array(lineItemSchema).min(1, 'At least one item required'),
  notes: z.string().optional(),
  discount: z.number().min(0).max(100).optional(),
});

type InvoiceForm = z.infer<typeof invoiceSchema>;
type LineItem = z.infer<typeof lineItemSchema>;

// Totals Calculator Component
function InvoiceTotals({ control }: { control: any }) {
  const items = useWatch({ control, name: 'items' }) as LineItem[];
  const discount = useWatch({ control, name: 'discount' }) as number | undefined;

  const totals = useMemo(() => {
    const subtotal = items.reduce(
      (sum, item) => sum + item.quantity * item.unitPrice,
      0
    );
    const taxTotal = items.reduce((sum, item) => {
      const lineTotal = item.quantity * item.unitPrice;
      return sum + lineTotal * ((item.taxRate ?? 0) / 100);
    }, 0);
    const discountAmount = subtotal * ((discount ?? 0) / 100);
    const total = subtotal + taxTotal - discountAmount;

    return { subtotal, taxTotal, discountAmount, total };
  }, [items, discount]);

  return (
    <div className="rounded-lg bg-gray-50 p-4">
      <div className="space-y-2 text-right">
        <div className="flex justify-between">
          <span>Subtotal:</span>
          <span>${totals.subtotal.toFixed(2)}</span>
        </div>
        <div className="flex justify-between">
          <span>Tax:</span>
          <span>${totals.taxTotal.toFixed(2)}</span>
        </div>
        {totals.discountAmount > 0 && (
          <div className="flex justify-between text-green-600">
            <span>Discount:</span>
            <span>-${totals.discountAmount.toFixed(2)}</span>
          </div>
        )}
        <div className="flex justify-between border-t pt-2 text-lg font-bold">
          <span>Total:</span>
          <span>${totals.total.toFixed(2)}</span>
        </div>
      </div>
    </div>
  );
}

// Line Item Row Component
function LineItemRow({
  index,
  register,
  remove,
  errors,
}: {
  index: number;
  register: any;
  remove: (index: number) => void;
  errors: any;
}) {
  return (
    <div className="grid grid-cols-12 gap-2 items-start">
      <div className="col-span-4">
        <input
          {...register(`items.${index}.description`)}
          placeholder="Description"
          aria-invalid={!!errors?.items?.[index]?.description}
          className="w-full rounded-md border px-3 py-2"
        />
        {errors?.items?.[index]?.description && (
          <p role="alert" className="text-xs text-red-600">
            {errors.items[index].description.message}
          </p>
        )}
      </div>
      <div className="col-span-2">
        <input
          type="number"
          {...register(`items.${index}.quantity`, { valueAsNumber: true })}
          placeholder="Qty"
          min={1}
          className="w-full rounded-md border px-3 py-2"
        />
      </div>
      <div className="col-span-2">
        <input
          type="number"
          step="0.01"
          {...register(`items.${index}.unitPrice`, { valueAsNumber: true })}
          placeholder="Price"
          min={0}
          className="w-full rounded-md border px-3 py-2"
        />
      </div>
      <div className="col-span-2">
        <input
          type="number"
          {...register(`items.${index}.taxRate`, { valueAsNumber: true })}
          placeholder="Tax %"
          min={0}
          max={100}
          className="w-full rounded-md border px-3 py-2"
        />
      </div>
      <div className="col-span-2">
        <button
          type="button"
          onClick={() => remove(index)}
          className="rounded-md bg-red-100 px-3 py-2 text-red-600 hover:bg-red-200"
          aria-label={`Remove item ${index + 1}`}
        >
          Remove
        </button>
      </div>
    </div>
  );
}

// Main Invoice Form
export function InvoiceBuilder() {
  const {
    register,
    control,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<InvoiceForm>({
    resolver: zodResolver(invoiceSchema),
    defaultValues: {
      invoiceNumber: `INV-${Date.now()}`,
      client: { name: '', email: '', address: '' },
      issueDate: new Date().toISOString().split('T')[0],
      dueDate: '',
      items: [{ description: '', quantity: 1, unitPrice: 0, taxRate: 0 }],
      notes: '',
      discount: 0,
    },
    mode: 'onBlur',
  });

  const { fields, append, remove, move } = useFieldArray({
    control,
    name: 'items',
  });

  const onSubmit = async (data: InvoiceForm) => {
    await api.createInvoice(data);
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-6">
      {/* Header Info */}
      <div className="grid grid-cols-2 gap-6">
        <div>
          <h2 className="text-lg font-semibold mb-4">Invoice Details</h2>
          <div className="space-y-4">
            <div>
              <label htmlFor="invoiceNumber" className="block text-sm font-medium">
                Invoice Number
              </label>
              <input
                id="invoiceNumber"
                {...register('invoiceNumber')}
                className="mt-1 block w-full rounded-md border px-3 py-2"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label htmlFor="issueDate" className="block text-sm font-medium">
                  Issue Date
                </label>
                <input
                  id="issueDate"
                  type="date"
                  {...register('issueDate')}
                  className="mt-1 block w-full rounded-md border px-3 py-2"
                />
              </div>
              <div>
                <label htmlFor="dueDate" className="block text-sm font-medium">
                  Due Date
                </label>
                <input
                  id="dueDate"
                  type="date"
                  {...register('dueDate')}
                  className="mt-1 block w-full rounded-md border px-3 py-2"
                />
              </div>
            </div>
          </div>
        </div>

        <div>
          <h2 className="text-lg font-semibold mb-4">Client Information</h2>
          <div className="space-y-4">
            <div>
              <label htmlFor="clientName" className="block text-sm font-medium">
                Client Name
              </label>
              <input
                id="clientName"
                {...register('client.name')}
                aria-invalid={!!errors.client?.name}
                className="mt-1 block w-full rounded-md border px-3 py-2"
              />
              {errors.client?.name && (
                <p role="alert" className="mt-1 text-sm text-red-600">
                  {errors.client.name.message}
                </p>
              )}
            </div>
            <div>
              <label htmlFor="clientEmail" className="block text-sm font-medium">
                Client Email
              </label>
              <input
                id="clientEmail"
                type="email"
                {...register('client.email')}
                className="mt-1 block w-full rounded-md border px-3 py-2"
              />
            </div>
            <div>
              <label htmlFor="clientAddress" className="block text-sm font-medium">
                Address (optional)
              </label>
              <textarea
                id="clientAddress"
                {...register('client.address')}
                rows={2}
                className="mt-1 block w-full rounded-md border px-3 py-2"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Line Items */}
      <div>
        <h2 className="text-lg font-semibold mb-4">Line Items</h2>

        {/* Column Headers */}
        <div className="grid grid-cols-12 gap-2 mb-2 text-sm font-medium text-gray-600">
          <div className="col-span-4">Description</div>
          <div className="col-span-2">Quantity</div>
          <div className="col-span-2">Unit Price</div>
          <div className="col-span-2">Tax Rate (%)</div>
          <div className="col-span-2">Actions</div>
        </div>

        <div className="space-y-3">
          {fields.map((field, index) => (
            <LineItemRow
              key={field.id} // Use field.id, NOT index!
              index={index}
              register={register}
              remove={remove}
              errors={errors}
            />
          ))}
        </div>

        {errors.items?.message && (
          <p role="alert" className="mt-2 text-sm text-red-600">
            {errors.items.message}
          </p>
        )}

        <button
          type="button"
          onClick={() =>
            append({ description: '', quantity: 1, unitPrice: 0, taxRate: 0 })
          }
          className="mt-4 rounded-md border border-blue-600 px-4 py-2 text-blue-600 hover:bg-blue-50"
        >
          + Add Line Item
        </button>
      </div>

      {/* Discount and Notes */}
      <div className="grid grid-cols-2 gap-6">
        <div>
          <label htmlFor="notes" className="block text-sm font-medium">
            Notes (optional)
          </label>
          <textarea
            id="notes"
            {...register('notes')}
            rows={3}
            placeholder="Payment terms, thank you message, etc."
            className="mt-1 block w-full rounded-md border px-3 py-2"
          />
        </div>
        <div>
          <label htmlFor="discount" className="block text-sm font-medium">
            Discount (%)
          </label>
          <input
            id="discount"
            type="number"
            {...register('discount', { valueAsNumber: true })}
            min={0}
            max={100}
            className="mt-1 block w-full rounded-md border px-3 py-2"
          />
        </div>
      </div>

      {/* Totals */}
      <InvoiceTotals control={control} />

      {/* Submit */}
      <div className="flex justify-end">
        <button
          type="submit"
          disabled={isSubmitting}
          className="rounded-md bg-blue-600 px-6 py-2 text-white disabled:opacity-50"
        >
          {isSubmitting ? 'Creating...' : 'Create Invoice'}
        </button>
      </div>
    </form>
  );
}
```

---

## 4. Contact Form with Server Actions (React 19)

Next.js Server Action form with progressive enhancement.

```typescript
// app/contact/actions.ts
'use server';

import { z } from 'zod';
import { revalidatePath } from 'next/cache';

const contactSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters'),
  email: z.string().email('Please enter a valid email'),
  subject: z.enum(['general', 'support', 'sales', 'partnership'], {
    errorMap: () => ({ message: 'Please select a subject' }),
  }),
  message: z.string().min(10, 'Message must be at least 10 characters'),
  urgent: z.boolean().optional(),
});

export type ContactFormState = {
  success?: boolean;
  errors?: {
    name?: string[];
    email?: string[];
    subject?: string[];
    message?: string[];
    _form?: string[];
  };
  message?: string;
};

export async function submitContactForm(
  prevState: ContactFormState | null,
  formData: FormData
): Promise<ContactFormState> {
  // Validate input
  const result = contactSchema.safeParse({
    name: formData.get('name'),
    email: formData.get('email'),
    subject: formData.get('subject'),
    message: formData.get('message'),
    urgent: formData.get('urgent') === 'on',
  });

  if (!result.success) {
    return {
      errors: result.error.flatten().fieldErrors,
    };
  }

  // Simulate processing delay
  await new Promise((resolve) => setTimeout(resolve, 1000));

  // Check for rate limiting (example)
  const rateLimitExceeded = false; // Replace with actual check
  if (rateLimitExceeded) {
    return {
      errors: {
        _form: ['Too many requests. Please try again later.'],
      },
    };
  }

  // Save to database
  try {
    await saveContactMessage(result.data);
    revalidatePath('/contact');
    return {
      success: true,
      message: 'Thank you! We will get back to you soon.',
    };
  } catch (error) {
    return {
      errors: {
        _form: ['Something went wrong. Please try again.'],
      },
    };
  }
}

// app/contact/page.tsx
'use client';

import { useActionState } from 'react';
import { submitContactForm, ContactFormState } from './actions';

export default function ContactPage() {
  const [state, formAction, isPending] = useActionState<
    ContactFormState | null,
    FormData
  >(submitContactForm, null);

  if (state?.success) {
    return (
      <div className="mx-auto max-w-md p-6">
        <div className="rounded-lg bg-green-50 p-6 text-center">
          <h2 className="text-xl font-semibold text-green-800">
            Message Sent!
          </h2>
          <p className="mt-2 text-green-600">{state.message}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-md p-6">
      <h1 className="text-2xl font-bold mb-6">Contact Us</h1>

      {/* Form-level errors */}
      {state?.errors?._form && (
        <div
          role="alert"
          className="mb-4 rounded-lg bg-red-50 p-4 text-red-600"
        >
          {state.errors._form.map((error, i) => (
            <p key={i}>{error}</p>
          ))}
        </div>
      )}

      <form action={formAction} className="space-y-4">
        {/* Name */}
        <div>
          <label htmlFor="name" className="block text-sm font-medium">
            Name
          </label>
          <input
            id="name"
            name="name"
            type="text"
            required
            aria-invalid={!!state?.errors?.name}
            aria-describedby={state?.errors?.name ? 'name-error' : undefined}
            className="mt-1 block w-full rounded-md border px-3 py-2"
          />
          {state?.errors?.name && (
            <p id="name-error" role="alert" className="mt-1 text-sm text-red-600">
              {state.errors.name[0]}
            </p>
          )}
        </div>

        {/* Email */}
        <div>
          <label htmlFor="email" className="block text-sm font-medium">
            Email
          </label>
          <input
            id="email"
            name="email"
            type="email"
            required
            aria-invalid={!!state?.errors?.email}
            aria-describedby={state?.errors?.email ? 'email-error' : undefined}
            className="mt-1 block w-full rounded-md border px-3 py-2"
          />
          {state?.errors?.email && (
            <p id="email-error" role="alert" className="mt-1 text-sm text-red-600">
              {state.errors.email[0]}
            </p>
          )}
        </div>

        {/* Subject */}
        <div>
          <label htmlFor="subject" className="block text-sm font-medium">
            Subject
          </label>
          <select
            id="subject"
            name="subject"
            required
            aria-invalid={!!state?.errors?.subject}
            className="mt-1 block w-full rounded-md border px-3 py-2"
          >
            <option value="">Select a subject</option>
            <option value="general">General Inquiry</option>
            <option value="support">Technical Support</option>
            <option value="sales">Sales</option>
            <option value="partnership">Partnership</option>
          </select>
          {state?.errors?.subject && (
            <p role="alert" className="mt-1 text-sm text-red-600">
              {state.errors.subject[0]}
            </p>
          )}
        </div>

        {/* Message */}
        <div>
          <label htmlFor="message" className="block text-sm font-medium">
            Message
          </label>
          <textarea
            id="message"
            name="message"
            rows={4}
            required
            aria-invalid={!!state?.errors?.message}
            aria-describedby={state?.errors?.message ? 'message-error' : undefined}
            className="mt-1 block w-full rounded-md border px-3 py-2"
          />
          {state?.errors?.message && (
            <p id="message-error" role="alert" className="mt-1 text-sm text-red-600">
              {state.errors.message[0]}
            </p>
          )}
        </div>

        {/* Urgent checkbox */}
        <div className="flex items-center">
          <input
            id="urgent"
            name="urgent"
            type="checkbox"
            className="h-4 w-4"
          />
          <label htmlFor="urgent" className="ml-2 text-sm">
            Mark as urgent
          </label>
        </div>

        {/* Submit */}
        <button
          type="submit"
          disabled={isPending}
          className="w-full rounded-md bg-blue-600 px-4 py-2 text-white disabled:opacity-50"
        >
          {isPending ? 'Sending...' : 'Send Message'}
        </button>
      </form>
    </div>
  );
}
```

---

## 5. Profile Settings with Async Username Validation

Form with async field validation and optimistic UI.

```typescript
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useState, useCallback } from 'react';
import debounce from 'lodash.debounce';

// Async username check
async function checkUsernameAvailable(username: string): Promise<boolean> {
  const response = await fetch(`/api/users/check-username?username=${username}`);
  const { available } = await response.json();
  return available;
}

const profileSchema = z.object({
  username: z
    .string()
    .min(3, 'Username must be at least 3 characters')
    .max(20, 'Username must be at most 20 characters')
    .regex(/^[a-zA-Z0-9_]+$/, 'Only letters, numbers, and underscores'),
  displayName: z.string().min(1, 'Display name is required'),
  bio: z.string().max(160, 'Bio must be at most 160 characters').optional(),
  website: z.string().url('Invalid URL').optional().or(z.literal('')),
  avatar: z.instanceof(FileList).optional(),
});

type ProfileForm = z.infer<typeof profileSchema>;

export function ProfileSettingsForm({ initialData }: { initialData: Partial<ProfileForm> }) {
  const [usernameStatus, setUsernameStatus] = useState<{
    checking: boolean;
    available: boolean | null;
    error: string | null;
  }>({ checking: false, available: null, error: null });

  const {
    register,
    handleSubmit,
    watch,
    setError,
    clearErrors,
    formState: { errors, isSubmitting, isDirty },
  } = useForm<ProfileForm>({
    resolver: zodResolver(profileSchema),
    defaultValues: {
      username: initialData.username ?? '',
      displayName: initialData.displayName ?? '',
      bio: initialData.bio ?? '',
      website: initialData.website ?? '',
    },
    mode: 'onBlur',
  });

  // Debounced username check
  const checkUsername = useCallback(
    debounce(async (username: string) => {
      if (username.length < 3 || username === initialData.username) {
        setUsernameStatus({ checking: false, available: null, error: null });
        return;
      }

      setUsernameStatus({ checking: true, available: null, error: null });

      try {
        const available = await checkUsernameAvailable(username);
        setUsernameStatus({ checking: false, available, error: null });

        if (!available) {
          setError('username', {
            type: 'manual',
            message: 'Username is already taken',
          });
        } else {
          clearErrors('username');
        }
      } catch {
        setUsernameStatus({
          checking: false,
          available: null,
          error: 'Failed to check username',
        });
      }
    }, 500),
    [initialData.username, setError, clearErrors]
  );

  const username = watch('username');

  // Check username when it changes
  const handleUsernameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    checkUsername(e.target.value);
  };

  const onSubmit = async (data: ProfileForm) => {
    // Don't submit if username check is pending or unavailable
    if (usernameStatus.checking || usernameStatus.available === false) {
      return;
    }
    await api.updateProfile(data);
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-6">
      {/* Username with async validation */}
      <div>
        <label htmlFor="username" className="block text-sm font-medium">
          Username
        </label>
        <div className="relative">
          <input
            id="username"
            {...register('username', {
              onChange: handleUsernameChange,
            })}
            aria-invalid={!!errors.username || usernameStatus.available === false}
            className="mt-1 block w-full rounded-md border px-3 py-2 pr-10"
          />
          <div className="absolute right-3 top-1/2 -translate-y-1/2">
            {usernameStatus.checking && (
              <span className="text-gray-400">⏳</span>
            )}
            {!usernameStatus.checking && usernameStatus.available === true && (
              <span className="text-green-500">✓</span>
            )}
            {!usernameStatus.checking && usernameStatus.available === false && (
              <span className="text-red-500">✗</span>
            )}
          </div>
        </div>
        {errors.username && (
          <p role="alert" className="mt-1 text-sm text-red-600">
            {errors.username.message}
          </p>
        )}
        {usernameStatus.available === true && !errors.username && (
          <p className="mt-1 text-sm text-green-600">Username is available!</p>
        )}
      </div>

      {/* Display Name */}
      <div>
        <label htmlFor="displayName" className="block text-sm font-medium">
          Display Name
        </label>
        <input
          id="displayName"
          {...register('displayName')}
          aria-invalid={!!errors.displayName}
          className="mt-1 block w-full rounded-md border px-3 py-2"
        />
        {errors.displayName && (
          <p role="alert" className="mt-1 text-sm text-red-600">
            {errors.displayName.message}
          </p>
        )}
      </div>

      {/* Bio with character count */}
      <div>
        <label htmlFor="bio" className="block text-sm font-medium">
          Bio
        </label>
        <textarea
          id="bio"
          {...register('bio')}
          rows={3}
          maxLength={160}
          className="mt-1 block w-full rounded-md border px-3 py-2"
        />
        <div className="mt-1 flex justify-between text-sm">
          {errors.bio && (
            <p role="alert" className="text-red-600">
              {errors.bio.message}
            </p>
          )}
          <span className="ml-auto text-gray-500">
            {watch('bio')?.length ?? 0}/160
          </span>
        </div>
      </div>

      {/* Website */}
      <div>
        <label htmlFor="website" className="block text-sm font-medium">
          Website
        </label>
        <input
          id="website"
          type="url"
          {...register('website')}
          placeholder="https://example.com"
          className="mt-1 block w-full rounded-md border px-3 py-2"
        />
        {errors.website && (
          <p role="alert" className="mt-1 text-sm text-red-600">
            {errors.website.message}
          </p>
        )}
      </div>

      {/* Avatar Upload */}
      <div>
        <label htmlFor="avatar" className="block text-sm font-medium">
          Avatar
        </label>
        <input
          id="avatar"
          type="file"
          accept="image/*"
          {...register('avatar')}
          className="mt-1 block w-full"
        />
      </div>

      {/* Submit */}
      <div className="flex gap-4">
        <button
          type="submit"
          disabled={isSubmitting || !isDirty || usernameStatus.checking}
          className="rounded-md bg-blue-600 px-4 py-2 text-white disabled:opacity-50"
        >
          {isSubmitting ? 'Saving...' : 'Save Changes'}
        </button>
        {isDirty && (
          <p className="self-center text-sm text-amber-600">
            You have unsaved changes
          </p>
        )}
      </div>
    </form>
  );
}
```

---

## 6. Survey Builder with Conditional Logic

Dynamic survey form with conditional fields and question types.

```typescript
import { useForm, useFieldArray, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';

// Question type definitions
const textQuestionSchema = z.object({
  type: z.literal('text'),
  question: z.string().min(1),
  required: z.boolean(),
  maxLength: z.number().optional(),
});

const choiceQuestionSchema = z.object({
  type: z.literal('choice'),
  question: z.string().min(1),
  required: z.boolean(),
  options: z.array(z.string().min(1)).min(2, 'At least 2 options required'),
  multiple: z.boolean(),
});

const ratingQuestionSchema = z.object({
  type: z.literal('rating'),
  question: z.string().min(1),
  required: z.boolean(),
  scale: z.enum(['5', '10']),
});

const questionSchema = z.discriminatedUnion('type', [
  textQuestionSchema,
  choiceQuestionSchema,
  ratingQuestionSchema,
]);

const surveySchema = z.object({
  title: z.string().min(1, 'Survey title is required'),
  description: z.string().optional(),
  questions: z.array(questionSchema).min(1, 'Add at least one question'),
});

type SurveyForm = z.infer<typeof surveySchema>;
type Question = z.infer<typeof questionSchema>;

// Question Editor Component
function QuestionEditor({
  index,
  control,
  register,
  remove,
  errors,
}: {
  index: number;
  control: any;
  register: any;
  remove: (index: number) => void;
  errors: any;
}) {
  const questionType = control._formValues.questions?.[index]?.type;

  return (
    <div className="rounded-lg border p-4 space-y-4">
      <div className="flex justify-between items-start">
        <span className="text-sm font-medium text-gray-500">
          Question {index + 1}
        </span>
        <button
          type="button"
          onClick={() => remove(index)}
          className="text-red-600 hover:text-red-800"
        >
          Remove
        </button>
      </div>

      {/* Question Type Selector */}
      <div>
        <label className="block text-sm font-medium">Question Type</label>
        <Controller
          name={`questions.${index}.type`}
          control={control}
          render={({ field }) => (
            <select
              {...field}
              className="mt-1 block w-full rounded-md border px-3 py-2"
            >
              <option value="text">Text Response</option>
              <option value="choice">Multiple Choice</option>
              <option value="rating">Rating Scale</option>
            </select>
          )}
        />
      </div>

      {/* Question Text */}
      <div>
        <label className="block text-sm font-medium">Question</label>
        <input
          {...register(`questions.${index}.question`)}
          placeholder="Enter your question"
          className="mt-1 block w-full rounded-md border px-3 py-2"
        />
        {errors?.questions?.[index]?.question && (
          <p role="alert" className="mt-1 text-sm text-red-600">
            {errors.questions[index].question.message}
          </p>
        )}
      </div>

      {/* Required Checkbox */}
      <div className="flex items-center">
        <input
          type="checkbox"
          {...register(`questions.${index}.required`)}
          className="h-4 w-4"
        />
        <label className="ml-2 text-sm">Required</label>
      </div>

      {/* Type-specific options */}
      {questionType === 'text' && (
        <div>
          <label className="block text-sm font-medium">Max Length (optional)</label>
          <input
            type="number"
            {...register(`questions.${index}.maxLength`, { valueAsNumber: true })}
            placeholder="No limit"
            className="mt-1 block w-full rounded-md border px-3 py-2"
          />
        </div>
      )}

      {questionType === 'choice' && (
        <ChoiceOptionsEditor index={index} control={control} register={register} />
      )}

      {questionType === 'rating' && (
        <div>
          <label className="block text-sm font-medium">Scale</label>
          <Controller
            name={`questions.${index}.scale`}
            control={control}
            render={({ field }) => (
              <select
                {...field}
                className="mt-1 block w-full rounded-md border px-3 py-2"
              >
                <option value="5">1-5 Stars</option>
                <option value="10">1-10 Scale</option>
              </select>
            )}
          />
        </div>
      )}
    </div>
  );
}

// Choice Options Editor
function ChoiceOptionsEditor({
  index,
  control,
  register,
}: {
  index: number;
  control: any;
  register: any;
}) {
  const { fields, append, remove } = useFieldArray({
    control,
    name: `questions.${index}.options`,
  });

  return (
    <div className="space-y-2">
      <label className="block text-sm font-medium">Options</label>
      {fields.map((field, optionIndex) => (
        <div key={field.id} className="flex gap-2">
          <input
            {...register(`questions.${index}.options.${optionIndex}`)}
            placeholder={`Option ${optionIndex + 1}`}
            className="flex-1 rounded-md border px-3 py-2"
          />
          <button
            type="button"
            onClick={() => remove(optionIndex)}
            className="px-2 text-red-600"
            disabled={fields.length <= 2}
          >
            ×
          </button>
        </div>
      ))}
      <button
        type="button"
        onClick={() => append('')}
        className="text-sm text-blue-600"
      >
        + Add Option
      </button>

      {/* Multiple selection toggle */}
      <div className="flex items-center mt-2">
        <input
          type="checkbox"
          {...register(`questions.${index}.multiple`)}
          className="h-4 w-4"
        />
        <label className="ml-2 text-sm">Allow multiple selections</label>
      </div>
    </div>
  );
}

// Main Survey Builder
export function SurveyBuilder() {
  const {
    register,
    control,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<SurveyForm>({
    resolver: zodResolver(surveySchema),
    defaultValues: {
      title: '',
      description: '',
      questions: [],
    },
    mode: 'onBlur',
  });

  const { fields, append, remove } = useFieldArray({
    control,
    name: 'questions',
  });

  const addQuestion = (type: Question['type']) => {
    const baseQuestion = { question: '', required: false };

    switch (type) {
      case 'text':
        append({ ...baseQuestion, type: 'text', maxLength: undefined });
        break;
      case 'choice':
        append({ ...baseQuestion, type: 'choice', options: ['', ''], multiple: false });
        break;
      case 'rating':
        append({ ...baseQuestion, type: 'rating', scale: '5' });
        break;
    }
  };

  const onSubmit = async (data: SurveyForm) => {
    await api.createSurvey(data);
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-6">
      {/* Survey Info */}
      <div className="space-y-4">
        <div>
          <label htmlFor="title" className="block text-sm font-medium">
            Survey Title
          </label>
          <input
            id="title"
            {...register('title')}
            aria-invalid={!!errors.title}
            className="mt-1 block w-full rounded-md border px-3 py-2"
          />
          {errors.title && (
            <p role="alert" className="mt-1 text-sm text-red-600">
              {errors.title.message}
            </p>
          )}
        </div>

        <div>
          <label htmlFor="description" className="block text-sm font-medium">
            Description (optional)
          </label>
          <textarea
            id="description"
            {...register('description')}
            rows={2}
            className="mt-1 block w-full rounded-md border px-3 py-2"
          />
        </div>
      </div>

      {/* Questions */}
      <div className="space-y-4">
        <h2 className="text-lg font-semibold">Questions</h2>

        {fields.map((field, index) => (
          <QuestionEditor
            key={field.id}
            index={index}
            control={control}
            register={register}
            remove={remove}
            errors={errors}
          />
        ))}

        {errors.questions?.message && (
          <p role="alert" className="text-sm text-red-600">
            {errors.questions.message}
          </p>
        )}

        {/* Add Question Buttons */}
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => addQuestion('text')}
            className="rounded-md border px-4 py-2 hover:bg-gray-50"
          >
            + Text Question
          </button>
          <button
            type="button"
            onClick={() => addQuestion('choice')}
            className="rounded-md border px-4 py-2 hover:bg-gray-50"
          >
            + Choice Question
          </button>
          <button
            type="button"
            onClick={() => addQuestion('rating')}
            className="rounded-md border px-4 py-2 hover:bg-gray-50"
          >
            + Rating Question
          </button>
        </div>
      </div>

      {/* Submit */}
      <button
        type="submit"
        disabled={isSubmitting}
        className="rounded-md bg-blue-600 px-6 py-2 text-white disabled:opacity-50"
      >
        {isSubmitting ? 'Creating...' : 'Create Survey'}
      </button>
    </form>
  );
}
```

---

## Quick Reference

```typescript
// ✅ Basic form setup
const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm({
  resolver: zodResolver(schema),
  defaultValues: { /* all fields */ },
  mode: 'onBlur',
});

// ✅ Field array with proper key
{fields.map((field, index) => (
  <div key={field.id}> {/* NOT index! */}
    <input {...register(`items.${index}.name`)} />
  </div>
))}

// ✅ Controller for third-party components
<Controller
  name="date"
  control={control}
  render={({ field, fieldState }) => (
    <DatePicker {...field} error={fieldState.error} />
  )}
/>

// ✅ Server Action with useActionState
const [state, formAction, isPending] = useActionState(serverAction, null);
<form action={formAction}>...</form>

// ✅ Step validation in wizard
const nextStep = async () => {
  const isValid = await methods.trigger(stepFields);
  if (isValid) setStep(s => s + 1);
};
```
