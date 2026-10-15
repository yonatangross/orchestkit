import { afterEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import {
  AudienceCompare,
  CopyPrompt,
  ModePicker,
  SignoffCompare,
  SurfaceCompare,
} from "@/components/output-modes";

function Page() {
  return (
    <>
      <ModePicker />
      <SurfaceCompare />
      <AudienceCompare />
      <SignoffCompare />
      <CopyPrompt />
    </>
  );
}

const flag = () => screen.getByLabelText("your flag").textContent;
const prompt = () => screen.getByLabelText("prompt").textContent;
const picked = () =>
  Array.from(document.querySelectorAll('figure[aria-current="true"] figcaption span:first-child')).map(
    (el) => el.textContent,
  );

afterEach(() => {
  cleanup();
  window.history.replaceState(null, "", "/");
  vi.unstubAllGlobals();
});

describe("output modes page islands", () => {
  it("starts at the default mode and outlines one panel per section", () => {
    render(<Page />);
    expect(flag()).toBe("/ork:glyph --chat");
    expect(prompt()).toBe("Answer with /ork:glyph --chat.");
    expect(picked()).toEqual(["chat", "operator", "without"]);
  });

  it("reads the mode from the query string, so a pick is a shareable link", () => {
    window.history.replaceState(null, "", "/?surface=ask&audience=novice&signoff=1");
    render(<Page />);
    expect(flag()).toBe("/ork:glyph --ask --eli5 --signoff");
    expect(picked()).toEqual(["ask", "novice (--eli5)", "with --signoff"]);
  });

  it("keeps every section in sync when the picker changes", () => {
    render(<Page />);
    act(() => {
      fireEvent.click(screen.getByRole("radio", { name: /page/ }));
    });
    act(() => {
      fireEvent.click(screen.getByRole("radio", { name: /novice/ }));
    });
    act(() => {
      fireEvent.click(screen.getByRole("checkbox"));
    });
    expect(flag()).toBe("/ork:glyph --page --eli5 --signoff");
    expect(prompt()).toBe("Answer with /ork:glyph --page --eli5 --signoff.");
    expect(window.location.search).toBe("?surface=page&audience=novice&signoff=1");
    expect(picked()).toEqual(["page", "novice (--eli5)", "with --signoff"]);
  });

  it("copies the prompt and says so", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal("navigator", { ...navigator, clipboard: { writeText } });
    render(<Page />);
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Copy as prompt" }));
    });
    expect(writeText).toHaveBeenCalledWith("Answer with /ork:glyph --chat.");
    expect(screen.getByRole("button", { name: "Copied" })).toBeTruthy();
  });

  it("falls back to a selected text box when the clipboard is blocked", async () => {
    vi.stubGlobal("navigator", {
      ...navigator,
      clipboard: { writeText: vi.fn().mockRejectedValue(new Error("denied")) },
    });
    render(<Page />);
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Copy JSON" }));
    });
    const box = screen.getByRole("textbox") as HTMLTextAreaElement;
    expect(JSON.parse(box.value)).toMatchObject({ skill: "ork:glyph", flag: "/ork:glyph --chat" });
    expect(screen.getByText(/blocked the clipboard/)).toBeTruthy();
  });
});
