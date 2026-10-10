// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { Modal } from "./Modal";

afterEach(cleanup);

describe("Modal", () => {
  it("labels the dialog by its title", async () => {
    render(
      <Modal open onClose={() => undefined} title="Edit goal">
        <p>body</p>
      </Modal>,
    );
    const dialog = await screen.findByRole("dialog");
    const labelId = dialog.getAttribute("aria-labelledby");
    expect(labelId).toBeTruthy();
    expect(document.getElementById(labelId!)?.textContent).toBe("Edit goal");
  });

  it("closes only the top-most modal on Escape", async () => {
    const closeOuter = vi.fn();
    const closeInner = vi.fn();
    render(
      <>
        <Modal open onClose={closeOuter} title="Outer">
          <p>outer</p>
        </Modal>
        <Modal open onClose={closeInner} title="Inner">
          <p>inner</p>
        </Modal>
      </>,
    );
    await screen.findAllByRole("dialog");

    act(() => {
      fireEvent.keyDown(document, { key: "Escape" });
    });

    expect(closeInner).toHaveBeenCalledTimes(1);
    expect(closeOuter).not.toHaveBeenCalled();
  });

  it("Escape on the discard prompt keeps the modal open", async () => {
    const onClose = vi.fn();
    render(
      <Modal open onClose={onClose} title="Draft" dirty>
        <p>draft</p>
      </Modal>,
    );
    await screen.findByRole("dialog");

    act(() => {
      fireEvent.keyDown(document, { key: "Escape" });
    });
    expect(screen.getByText("Discard unsaved changes?")).toBeTruthy();

    act(() => {
      fireEvent.keyDown(document, { key: "Escape" });
    });
    expect(screen.queryByText("Discard unsaved changes?")).toBeNull();
    expect(onClose).not.toHaveBeenCalled();
  });
});
