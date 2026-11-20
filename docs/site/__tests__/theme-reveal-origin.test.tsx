import { describe, it, expect } from "vitest";
import { revealOrigin } from "../components/theme-reveal-origin";

function rect(el: Element, left: number, top: number, width: number, height: number) {
	el.getBoundingClientRect = () =>
		({ left, top, width, height, right: left + width, bottom: top + height, x: left, y: top, toJSON: () => ({}) }) as DOMRect;
}

describe("revealOrigin", () => {
	it("returns the centre of the pressed theme button", () => {
		document.body.innerHTML = `<div data-theme-toggle><button aria-label="Light"><svg><path/></svg></button></div>`;
		const button = document.querySelector("button")!;
		rect(button, 1350, 62, 26, 26);
		const icon = document.querySelector("path")!;
		expect(revealOrigin(icon)).toEqual({ x: 1363, y: 75 });
	});

	it("falls back to the toggle itself for the single light-dark button", () => {
		document.body.innerHTML = `<button data-theme-toggle><span>sun</span></button>`;
		const toggle = document.querySelector("[data-theme-toggle]")!;
		rect(toggle, 100, 40, 60, 30);
		expect(revealOrigin(document.querySelector("span")!)).toEqual({ x: 130, y: 55 });
	});

	it("ignores clicks outside the theme switch", () => {
		document.body.innerHTML = `<nav><button>Docs</button></nav>`;
		expect(revealOrigin(document.querySelector("button")!)).toBeNull();
	});
});
