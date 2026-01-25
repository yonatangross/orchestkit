// Composed Trigger Pattern - Combining Multiple Radix Primitives
// Example: Button that shows tooltip AND opens dialog

import * as React from 'react'
import { Dialog, Tooltip } from 'radix-ui'
import { Button } from '@/components/ui/button'

// Reusable forward-ref button
const TriggerButton = React.forwardRef<
  HTMLButtonElement,
  React.ButtonHTMLAttributes<HTMLButtonElement>
>((props, ref) => (
  <Button ref={ref} {...props} />
))
TriggerButton.displayName = 'TriggerButton'

// Dialog with Tooltip on trigger
export function DialogWithTooltip({
  tooltipContent,
  dialogTitle,
  dialogContent,
  triggerLabel,
}: {
  tooltipContent: string
  dialogTitle: string
  dialogContent: React.ReactNode
  triggerLabel: string
}) {
  return (
    <Dialog.Root>
      <Tooltip.Root>
        <Tooltip.Trigger asChild>
          <Dialog.Trigger asChild>
            <TriggerButton>{triggerLabel}</TriggerButton>
          </Dialog.Trigger>
        </Tooltip.Trigger>
        <Tooltip.Portal>
          <Tooltip.Content
            className="bg-gray-900 text-white px-3 py-1.5 rounded text-sm"
            sideOffset={5}
          >
            {tooltipContent}
            <Tooltip.Arrow className="fill-gray-900" />
          </Tooltip.Content>
        </Tooltip.Portal>
      </Tooltip.Root>

      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-black/50" />
        <Dialog.Content className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 bg-white rounded-lg p-6 w-full max-w-md">
          <Dialog.Title className="text-lg font-semibold">
            {dialogTitle}
          </Dialog.Title>
          <div className="mt-4">{dialogContent}</div>
          <Dialog.Close asChild>
            <Button className="mt-4">Close</Button>
          </Dialog.Close>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}

// Usage:
/*
<DialogWithTooltip
  tooltipContent="Click to open settings"
  triggerLabel="Settings"
  dialogTitle="Application Settings"
  dialogContent={<SettingsForm />}
/>
*/

// Dropdown Menu Item as Link
import { DropdownMenu } from 'radix-ui'
import Link from 'next/link'

export function NavigationDropdown() {
  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger asChild>
        <Button variant="outline">Navigate</Button>
      </DropdownMenu.Trigger>

      <DropdownMenu.Portal>
        <DropdownMenu.Content className="min-w-[160px] bg-white rounded-md shadow-lg p-1">
          {/* asChild makes Link receive the menu item styles/behavior */}
          <DropdownMenu.Item asChild>
            <Link href="/dashboard" className="block px-2 py-1.5 rounded hover:bg-gray-100">
              Dashboard
            </Link>
          </DropdownMenu.Item>
          <DropdownMenu.Item asChild>
            <Link href="/settings" className="block px-2 py-1.5 rounded hover:bg-gray-100">
              Settings
            </Link>
          </DropdownMenu.Item>
          <DropdownMenu.Item asChild>
            <Link href="/profile" className="block px-2 py-1.5 rounded hover:bg-gray-100">
              Profile
            </Link>
          </DropdownMenu.Item>
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  )
}

// Tooltip Provider Wrapper for App
export function TooltipProvider({ children }: { children: React.ReactNode }) {
  return (
    <Tooltip.Provider
      delayDuration={400}
      skipDelayDuration={300}
    >
      {children}
    </Tooltip.Provider>
  )
}
