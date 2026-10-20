# Prompt Enhancer

Requires Claude Code 2.1.300 or later.

Beta (experimental, version 0.x). Each Enhance click costs model usage on your own account: one Haiku call with a 1024 token cap.

The band sits above the prompt box. Type a draft and press Enhance.
Or type a prompt that ends in `++` and press Enter.
The mod holds the prompt and puts the rewrite in the box.
Edit it, then press Send or Enter. Send submits the current box as your own words.
Undo puts the exact original text back, including the trigger when you typed it.
Enhance a rewrite again without editing it, and Undo still goes back to your first draft. Edit the rewrite first, and Undo goes back to your edit.
A rewrite that ends in `++` (for example `C++`) is sent as is when you press Enter on it.
To send a prompt you typed that ends in `++` without a rewrite, press Send instead of Enter.
The collapse control hides the buttons. Press the expand control to show them.

Enhance uses the session model client with the `haiku` alias.
Each click can incur model usage charges under the session account.
The system prompt is fixed in `src/system.ts`.
It asks for typo fixes, named ambiguities, a repo read, a clear done check, and questions when intent is unclear.
The call has a 12 second timeout and a 1024 token cap.

If the call fails or returns no text, the original stays in the box and a toast appears.
The mod never sends a rewrite during Enhance. It sends only the visible box after a user action.
Edits during a model call cancel that result. Undo also cancels a pending result.
Slash commands, attachments, and prompts from other sources pass through without enhancement.
Use Enter for attachments and file mentions. The plugin Send API does not expand them.
Another installed mod can still change a fill or submission through its own hooks.

## Local checks

Use the package test and typecheck scripts. Validate this plugin with the Claude CLI.
The tests drive the real hook exports with a fake engine. They do not make model calls.
The pinned engine declarations supplied for version 2.1.300 define the API facade in `src/api.ts`.
The state contract lives in `types/index.d.ts`.
