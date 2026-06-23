// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, cleanup, fireEvent } from "@testing-library/react";

import Modal from "./Modal.tsx";

afterEach(cleanup);

describe("Modal", () => {
  it("renders into a portal on <body> with dialog ARIA when open", () => {
    render(
      <Modal open onClose={() => {}} backdropClassName="bd" className="md" ariaLabel="Test">
        <p>body</p>
      </Modal>,
    );
    const dialog = screen.getByRole("dialog");
    expect(dialog).toHaveClass("md");
    expect(dialog).toHaveAttribute("aria-modal", "true");
    expect(dialog.parentElement).toHaveClass("bd");
  });

  it("renders nothing when closed", () => {
    render(
      <Modal open={false} onClose={() => {}} backdropClassName="bd" className="md">
        <p>body</p>
      </Modal>,
    );
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("closes on Escape and on backdrop click, but not on inner click", () => {
    const onClose = vi.fn();
    render(
      <Modal open onClose={onClose} backdropClassName="bd" className="md" ariaLabel="T">
        <button type="button">inside</button>
      </Modal>,
    );
    fireEvent.click(screen.getByText("inside"));
    expect(onClose).not.toHaveBeenCalled();

    fireEvent.keyDown(document, { key: "Escape" });
    expect(onClose).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByRole("dialog").parentElement!);
    expect(onClose).toHaveBeenCalledTimes(2);
  });

  it("respects closeOnEscape={false}", () => {
    const onClose = vi.fn();
    render(
      <Modal open onClose={onClose} backdropClassName="bd" className="md" ariaLabel="T" closeOnEscape={false}>
        <span>x</span>
      </Modal>,
    );
    fireEvent.keyDown(document, { key: "Escape" });
    expect(onClose).not.toHaveBeenCalled();
  });

  it("appends the full-screen class when full", () => {
    render(
      <Modal open onClose={() => {}} backdropClassName="bd" className="md" ariaLabel="T" full>
        <span>x</span>
      </Modal>,
    );
    expect(screen.getByRole("dialog")).toHaveClass("md", "is-full");
  });
});
